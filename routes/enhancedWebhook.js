const express = require('express');
const axios = require('axios');
const router = express.Router();
const WhatsAppService = require('../services/whatsappService');
const BotConversationService = require('../services/botConversationService');
const Message = require('../models/Message');
const Customer = require('../models/Customer');
const Ticket = require('../models/Ticket');
const { executeQuery } = require('../config/database');

// Initialize services
const whatsappService = new WhatsAppService();
const botConversationService = new BotConversationService();

// Helper: Send a WhatsApp message programmatically
async function sendWhatsappMessage(phoneNumber, message) {
    try {
        console.log("Sending WhatsApp message to:", phoneNumber, message);
        
        // Format phone number properly
        let formattedPhone = phoneNumber;
        if (phoneNumber) {
            // Remove all non-digit characters
            formattedPhone = phoneNumber.toString().replace(/\D/g, '');
            
            // Add country code if not present (assuming India +91)
            if (formattedPhone.length === 10) {
                formattedPhone = '91' + formattedPhone;
            }
            
            // Ensure it's not empty
            if (!formattedPhone) {
                console.error('❌ Invalid phone number:', phoneNumber);
                return { success: false, error: 'Invalid phone number' };
            }
        } else {
            console.error('❌ Phone number is null or undefined');
            return { success: false, error: 'Phone number is required' };
        }
        
        const phoneNumberId = '639323635919894'; // Your business number ID
        const token = process.env.WHATSAPP_ACCESS_TOKEN; // Load from .env
        const url = `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            to: formattedPhone, // Must be in international format, no +
            type: 'text',
            text: { body: message }
        };

        console.log('📱 Sending message to:', formattedPhone);

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, data, { headers });
        console.log('✅ Message sent:', response.data);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ sendWhatsappMessage error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Webhook verification endpoint
router.get('/', (req, res) => {
    console.log("webhook_get", req.query);
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification request:', { mode, token, challenge });

    const verificationResult = whatsappService.verifyWebhook(mode, token, challenge);

    if (verificationResult) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
});

// Webhook endpoint for receiving messages
router.post('/', async (req, res) => {
    try {
        // Log webhook data to database
        const logQuery = 'INSERT INTO webhook_logs (webhook_data) VALUES (?)';
        await executeQuery(logQuery, [JSON.stringify(req.body)]);
        console.log("webhook_post", req.body);
        
        // Process webhook data
        const messages = whatsappService.processWebhook(req.body);
        console.log("messages", messages);
        
        if (messages.length === 0) {
            console.log('No messages to process');
            return res.status(200).json({ status: 'success', message: 'No messages to process' });
        }

        // Process each message
        const results = [];
        for (const message of messages) {
            console.log(`Processing message from ${message.from}: ${message.text}`);

            const phoneNumber = whatsappService.formatPhoneNumber(message.from);
            const messageText = message.text || '';
           
            // Save the incoming message to database
            await botConversationService.saveMessage(phoneNumber, messageText, 'customer');
            
            // Get current conversation state
            const stateResult = await botConversationService.getConversationState(phoneNumber);
            console.log("Current state:", stateResult);
            
            if (!stateResult.success) {
                console.error('Failed to get conversation state:', stateResult.error);
                continue;
            }

            const currentState = stateResult.data;
            console.log("Current state data:", currentState);

            // Handle /start command
            if (messageText.toLowerCase().trim() === '/start') {
                const startResult = await botConversationService.handleStartCommand(phoneNumber);
                if (startResult.success) {
                    await sendWhatsappMessage(phoneNumber, startResult.message);
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Error processing /start command. Please try again.');
                }
                continue;
            }

            // Handle different conversation states
            if (!currentState) {
                // No conversation state - treat as /start
                const startResult = await botConversationService.handleStartCommand(phoneNumber);
                if (startResult.success) {
                    await sendWhatsappMessage(phoneNumber, startResult.message);
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Error processing request. Please try again.');
                }
                continue;
            }

            // Handle ticket selection state
            if (currentState.automationChatState === 'ticket_selection') {
                const openTicketsResult = await botConversationService.getOpenTickets(phoneNumber);
                if (openTicketsResult.success) {
                    const selectionResult = await botConversationService.handleTicketSelection(
                        phoneNumber, 
                        messageText, 
                        openTicketsResult.data || []
                    );
                    
                    if (selectionResult.success) {
                        await sendWhatsappMessage(phoneNumber, selectionResult.message);
                    } else {
                        await sendWhatsappMessage(phoneNumber, selectionResult.error);
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Error getting open tickets. Please try again.');
                }
                continue;
            }

            // Handle agent chat request state
            if (currentState.automationChatState === 'agent_chat_request') {
                const chatRequestResult = await botConversationService.handleAgentChatRequest(
                    phoneNumber, 
                    messageText, 
                    currentState.currentTicketId
                );
                
                if (chatRequestResult.success) {
                    await sendWhatsappMessage(phoneNumber, chatRequestResult.message);
                    
                    // If customer wants to chat with agent, notify agents
                    if (chatRequestResult.action === 'start_agent_chat') {
                        try {
                            const socketService = req.app.get('socketService');
                            if (socketService) {
                                const ticket = await Ticket.findById(currentState.currentTicketId);
                                if (ticket) {
                                    socketService.broadcastToAgents('newCustomerMessage', {
                                        ticket: ticket,
                                        message: {
                                            message_text: chatRequestResult.message,
                                            created_at: new Date().toISOString(),
                                            sender_type: 'system'
                                        },
                                        customer: { phone_number: phoneNumber }
                                    });
                                }
                            }
                        } catch (e) {
                            console.error('Socket broadcast error:', e);
                        }
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, chatRequestResult.error);
                }
                continue;
            }

            // Handle ticket type selection state
            if (currentState.automationChatState === 'ticket_type_selection') {
                const typeSelectionResult = await botConversationService.handleTicketTypeSelection(
                    phoneNumber, 
                    messageText
                );
                
                if (typeSelectionResult.success) {
                    await sendWhatsappMessage(phoneNumber, typeSelectionResult.message);
                } else {
                    await sendWhatsappMessage(phoneNumber, typeSelectionResult.error);
                }
                continue;
            }

            // Handle form filling state
            if (currentState.automationChatState === 'form_filling') {
                const formResult = await botConversationService.handleFormFilling(
                    phoneNumber, 
                    messageText, 
                    currentState.ticketType, 
                    currentState.formData
                );
                
                if (formResult.success) {
                    if (formResult.action === 'ticket_created') {
                        await sendWhatsappMessage(phoneNumber, formResult.message);
                    } else {
                        // Continue form filling - no response needed
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, formResult.error);
                }
                continue;
            }

            // Handle new ticket state
            if (currentState.automationChatState === 'new_ticket') {
                const typeSelectionResult = await botConversationService.handleTicketTypeSelection(
                    phoneNumber, 
                    messageText
                );
                
                if (typeSelectionResult.success) {
                    await sendWhatsappMessage(phoneNumber, typeSelectionResult.message);
                } else {
                    await sendWhatsappMessage(phoneNumber, typeSelectionResult.error);
                }
                continue;
            }

            // Handle open chat state (customer chatting with agent)
            if (currentState.currentStep === 'OPEN' && currentState.currentTicketId) {
                // Save message to ticket
                await botConversationService.saveMessage(phoneNumber, messageText, 'customer', currentState.currentTicketId);
                
                // Notify agents
                try {
                    const socketService = req.app.get('socketService');
                    if (socketService) {
                        const ticket = await Ticket.findById(currentState.currentTicketId);
                        if (ticket) {
                            socketService.broadcastToAgents('newCustomerMessage', {
                                ticket: ticket,
                                message: {
                                    message_text: messageText,
                                    created_at: new Date().toISOString(),
                                    sender_type: 'customer'
                                },
                                customer: { phone_number: phoneNumber }
                            });
                        }
                    }
                } catch (e) {
                    console.error('Socket broadcast error:', e);
                }
                continue;
            }

            // Default response for unrecognized messages
            await sendWhatsappMessage(phoneNumber, 'I didn\'t understand that. Please try again or type /start to begin.');

            results.push({
                messageId: message.id,
                from: message.from,
                success: true,
                error: null
            });
        }

        console.log('✅ Webhook processed successfully');

        res.status(200).json({
            status: 'success',
            processed: results.length,
            results: results
        });

    } catch (error) {
        console.error('❌ Webhook processing error:', error);

        // Log error to database
        const logQuery = 'INSERT INTO webhook_logs (webhook_data, processed, error_message) VALUES (?, ?, ?)';
        await executeQuery(logQuery, [JSON.stringify(req.body), false, error.message]);

        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Test endpoint to send a message
router.post('/test-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                error: 'Phone number and message are required'
            });
        }

        const result = await sendWhatsappMessage(phoneNumber, message);

        res.status(200).json({
            success: result.success,
            data: result.data,
            error: result.error
        });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to get webhook logs
router.get('/webhook-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const query = `
            SELECT id, webhook_data, processed, error_message, created_at
            FROM webhook_logs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const result = await executeQuery(query, [limit, offset]);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                page: page,
                limit: limit
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error fetching webhook logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Enhanced WhatsApp Webhook Service'
    });
});

module.exports = router;
