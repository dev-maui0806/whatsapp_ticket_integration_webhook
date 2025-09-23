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

// Helper: Broadcast message to dashboard
function broadcastToDashboard(req, phoneNumber, message, senderType = 'system') {
    try {
        const io = req.app.get('io');
        if (io) {
            io.emit('newCustomerMessage', {
                phone_number: phoneNumber,
                message: {
                    message_text: message,
                    created_at: new Date().toISOString(),
                    sender_type: senderType
                },
                customer: { phone_number: phoneNumber }
            });
        }
    } catch (e) {
        console.error('Socket broadcast error:', e);
    }
}

// Helper: Send a WhatsApp message programmatically (delegates to service)
async function sendWhatsappMessage(phoneNumber, message) {
    try {
        console.log("Sending WhatsApp message to:", phoneNumber, message);
        const result = await whatsappService.sendMessage(phoneNumber, message);
        if (!result || result.success === false) {
            console.error('❌ WhatsApp send failed:', result?.error || 'unknown error');
        }
        return result || { success: false, error: 'Unknown send error' };
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
            console.log(`***************Processing message from******************* ${message.from}: ${message.text}`);

            const phoneNumber = whatsappService.formatPhoneNumber(message.from);
            const messageText = message.text || '';
            const interactiveId = message.interactive?.id || null;
            
            // Validate phone number
            if (!phoneNumber) {
                console.error('❌ Invalid phone number:', message.from);
                results.push({
                    messageId: message.id,
                    from: message.from,
                    success: false,
                    error: 'Invalid phone number'
                });
                continue;
            }
            
            // Skip empty messages
            if (!messageText.trim()) {
                console.log('⚠️ Skipping empty message');
                results.push({
                    messageId: message.id,
                    from: message.from,
                    success: true,
                    skipped: 'Empty message'
                });
                continue;
            }
            
            console.log(`✅ Formatted phone number: ${phoneNumber}`);
           
            // Save the incoming message to database and broadcast to dashboard immediately
            const savedIncoming = await botConversationService.saveMessage(phoneNumber, messageText, 'customer');
            try {
                if (savedIncoming && savedIncoming.success && savedIncoming.data) {
                    broadcastToDashboard(req, phoneNumber, savedIncoming.data.message_text, 'customer');
                    
                    // Emit customer stats update for new message (pending chats)
                    try {
                        const io = req.app.get('io');
                        if (io) {
                            const customer = await Customer.findByPhoneWithStats(phoneNumber);
                            if (customer && customer.success) {
                                io.emit('customerUpdated', {
                                    id: customer.data.id,
                                    phone_number: phoneNumber,
                                    open_tickets: customer.data.open_tickets,
                                    pending_chats: customer.data.pending_chats,
                                    total_tickets: customer.data.total_tickets || 0,
                                    closed_tickets: customer.data.closed_tickets || 0
                                });
                                
                                // Emit dashboard stats update
                                io.emit('dashboardStatsUpdated', {
                                    type: 'new_message',
                                    customer: customer.data
                                });
                                
                                console.log('✅ New message events emitted successfully');
                            }
                        }
                    } catch (statsError) {
                        console.error('❌ Error emitting new message stats events:', statsError);
                        // Continue processing even if stats update fails
                    }
                } else {
                    // Fallback broadcast without DB payload
                    broadcastToDashboard(req, phoneNumber, messageText, 'customer');
                }
            } catch (e) {
                console.error('Socket broadcast (incoming customer message) error:', e);
            }
            
            // Get current conversation state
            const stateResult = await botConversationService.getConversationState(phoneNumber);
            console.log("**************Current state:*****************", stateResult);
            
            if (!stateResult.success) {
                console.log("sartResult*********", startResult)
                console.error('Failed to get conversation state:', stateResult.error);
                // Continue processing with null state instead of skipping
                const currentState = null;
                // Handle message without state (treat as new customer)
                const startResult = await botConversationService.handleStartCommand(phoneNumber);
                if (startResult.success) {
                    await sendWhatsappMessage(phoneNumber, startResult.message);
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Error processing request. Please try again.');
                }
                continue;
            }

            const currentState = stateResult.data;
            console.log("**************Current state data:***************", currentState);

            // Handle /start command or greeting_start button
            if (messageText.toLowerCase().trim() === '/start') {
                console.log("**********openticketstart******", phoneNumber)
                const startResult = await botConversationService.handleStartCommand(phoneNumber);
                if (startResult.success) {
                    console.log("(**************staratresultsuccess", startResult);    
                // For interactive menus, startResult.message may be empty because buttons were sent.
                    if (startResult.message) {
                        await sendWhatsappMessage(phoneNumber, startResult.message);
                        broadcastToDashboard(req, phoneNumber, startResult.message, 'system');
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Error processing /start command. Please try again.');
                }
                continue;
            }

            // Handle different conversation states
            if (!currentState) {
                // No conversation state - check if this is a greeting or /start command
                if (messageText.toLowerCase().trim() === '/start') {
                    const startResult = await botConversationService.handleStartCommand(phoneNumber);
                    if (startResult.success) {
                        await sendWhatsappMessage(phoneNumber, startResult.message);
                    } else {
                        await sendWhatsappMessage(phoneNumber, 'Error processing /start command. Please try again.');
                    }
                } else {
                    // This is likely an initial greeting (HELLO, Hi, etc.)
                    const greetingResult = await botConversationService.handleInitialGreeting(phoneNumber, messageText, message.profileName);
                    console.log("greetingresult", greetingResult);
                    if (greetingResult.success) {
                        if (greetingResult.message) {
                            await sendWhatsappMessage(phoneNumber, greetingResult.message);
                            broadcastToDashboard(req, phoneNumber, greetingResult.message, 'system');
                        }
                        // If message is null, customer already received greeting, no need to send again
                    } else {
                        await sendWhatsappMessage(phoneNumber, 'Error processing greeting. Please try again.');
                    }
                }
                continue;
            }

            // Handle ticket selection state
            if (currentState.automationChatState === 'ticket_selection') {
                const openTicketsResult = await botConversationService.getOpenTickets(phoneNumber);
                console.log("***********openresultticket", openTicketsResult)
                if (openTicketsResult.success) {
                    const selectionResult = await botConversationService.handleTicketSelection(
                        phoneNumber, 
                        interactiveId ? `id:${interactiveId}` : messageText, 
                        openTicketsResult.data || []
                    );
                    
                    if (selectionResult.success) {
                       if(!selectionResult.interactiveSent) await sendWhatsappMessage(phoneNumber, selectionResult.message);
                        broadcastToDashboard(req, phoneNumber, selectionResult.message, 'system');
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
                    interactiveId ? `id:${interactiveId}` : messageText, 
                    currentState.currentTicketId
                );
                
                if (chatRequestResult.success) {
                    await sendWhatsappMessage(phoneNumber, chatRequestResult.message);
                    broadcastToDashboard(req, phoneNumber, chatRequestResult.message, 'system');
                    
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
            if (currentState.automationChatState == 'ticket_type_selection') {

                console.log("***********ticket_type_selection***************", currentState.automationChatState, phoneNumber, interactiveId, messageText)
                
                const typeSelectionResult = await botConversationService.handleTicketTypeSelection(
                    phoneNumber, 
                    interactiveId ? `id:${interactiveId}` : messageText
                );
                
                if (typeSelectionResult.success) {
                    // Only send plain text message if no interactive message was sent
                    if (!typeSelectionResult.interactiveSent) {
                        await sendWhatsappMessage(phoneNumber, typeSelectionResult.message);
                    }
                    // Always broadcast to dashboard for consistency
                    broadcastToDashboard(req, phoneNumber, typeSelectionResult.message, 'system');
                } else {
                    // Send error message as string, not object
                    const errorMessage = typeof typeSelectionResult.error === 'string' 
                        ? typeSelectionResult.error 
                        : 'Failed to process ticket type selection. Please try again.';
                    await sendWhatsappMessage(phoneNumber, errorMessage);
                }
                continue;
            }


            // Handle form filling state
            if (currentState.automationChatState === 'form_filling') {
                const formResult = await botConversationService.handleFormFilling(
                    phoneNumber, 
                    messageText, 
                    currentState.ticketType, 
                    currentState.formData,
                    interactiveId
                );
                
                if (formResult.success) {
                    if (formResult.action === 'ticket_created') {
                        await sendWhatsappMessage(phoneNumber, formResult.message);
                        broadcastToDashboard(req, phoneNumber, formResult.message, 'system');
                        
                        // Emit socket events for real-time dashboard updates
                        const io = req.app.get('io');
                        await botConversationService.emitTicketCreatedEvents(phoneNumber, formResult.ticket, io);
                    } else if (formResult.message) {
                        await sendWhatsappMessage(phoneNumber, formResult.message);
                        broadcastToDashboard(req, phoneNumber, formResult.message, 'system');
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, formResult.error);
                }
                continue;
            }

            // Handle new ticket state
            if (currentState.automationChatState === 'new_ticket') {
                const newTicketResult = await botConversationService.handleNewTicketSelection(
                    phoneNumber, 
                    messageText
                );
                
                if (newTicketResult.success && newTicketResult.interactiveSent ) {
                    // await sendWhatsappMessage(phoneNumber, newTicketResult.message);
                    broadcastToDashboard(req, phoneNumber, newTicketResult.message, 'system');
        } else {
                    await sendWhatsappMessage(phoneNumber, newTicketResult.error);
                }
                continue;
            }

            // Handle open chat state (customer chatting with agent)
            if (currentState.currentStep === 'OPEN' && currentState.currentTicketId) {
                // Save message to ticket
                await botConversationService.saveMessage(phoneNumber, messageText, 'customer', currentState.currentTicketId);
                
                // Broadcast to dashboard
                broadcastToDashboard(req, phoneNumber, messageText, 'customer');
                
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
            const defaultMessage = 'I didn\'t understand that. Please try again or type /start to begin.';
            await sendWhatsappMessage(phoneNumber, defaultMessage);
            broadcastToDashboard(req, phoneNumber, defaultMessage, 'system');

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

// Helper function to extract form data from WhatsApp template completion
function extractFormDataFromMessage(messageText, ticketType) {
    // This is a placeholder - in real implementation, WhatsApp would send structured data
    // For now, we'll create sample data based on ticket type
    const formDataMap = {
        'lock_open': {
            vehicle_number: 'Sample Vehicle',
            driver_number: 'Sample Driver',
            location: 'Sample Location',
            comment: 'Sample Comment'
        },
        'lock_repair': {
            vehicle_number: 'Sample Vehicle',
            driver_number: 'Sample Driver', 
            location: 'Sample Location',
            availability_date: '2024-01-01',
            availability_time: '10:00',
            comment: 'Sample Comment'
        },
        'fund_request': {
            amount: '1000',
            upi_id: 'sample@upi',
            comment: 'Sample Comment'
        },
        'fuel_request': {
            vehicle_number: 'Sample Vehicle',
            fuel_type: 'Petrol',
            quantity: '50',
            amount: '5000',
            location: 'Sample Location',
            comment: 'Sample Comment'
        }
    };
    
    return formDataMap[ticketType] || {};
}

// Health check endpoint
router.get('/health', (req, res) => {
            res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Enhanced WhatsApp Webhook Service'
    });
});

module.exports = router;
