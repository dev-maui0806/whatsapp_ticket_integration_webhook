const express = require('express');
const router = express.Router();
const WhatsAppService = require('../services/whatsappService');
const EnhancedTicketService = require('../services/enhancedTicketService');
const { executeQuery } = require('../config/database');

// Initialize services
const whatsappService = new WhatsAppService();
const enhancedTicketService = new EnhancedTicketService();

// Webhook verification endpoint
router.get('/', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Enhanced webhook verification request:', { mode, token, challenge });

    const verificationResult = whatsappService.verifyWebhook(mode, token, challenge);
    
    if (verificationResult) {
        console.log('✅ Enhanced webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Enhanced webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
});

// Enhanced webhook endpoint for receiving messages
router.post('/', async (req, res) => {
    try {
        console.log('📨 Enhanced webhook received:', JSON.stringify(req.body, null, 2));

        // Log webhook data to database
        const logQuery = 'INSERT INTO webhook_logs (webhook_data) VALUES (?)';
        await executeQuery(logQuery, [JSON.stringify(req.body)]);

        // Access socket service for realtime broadcasting
        const socketService = req.app.get('socketService');

        // Process webhook data
        const messages = whatsappService.processWebhook(req.body);
        
        if (messages.length === 0) {
            console.log('No messages to process');
            return res.status(200).json({ status: 'success', message: 'No messages to process' });
        }

        // Process each message with enhanced ticket service
        const results = [];
        for (const message of messages) {
            console.log(`Processing enhanced message from ${message.from}: ${message.text}`);
            
            try {
                const result = await enhancedTicketService.processIncomingMessage(message);
                results.push({
                    from: message.from,
                    success: result.success,
                    message: result.message || result.error,
                    ticket: result.ticket || null
                });

                // Realtime updates to agents dashboard
                if (socketService && result.success) {
                    // Only broadcast to dashboard once a ticket exists (created or bound)
                    if (result.ticket) {
                        const ensuredTicket = {
                            ...result.ticket,
                            ticket_number: result.ticket.ticket_number || `TCK-${result.ticket.id}`
                        };
                        // Broadcast the incoming customer message to all agents for that ticket
                        socketService.broadcastToAgents('newCustomerMessage', {
                            ticket: ensuredTicket,
                            message: {
                                message_text: message.text || '',
                                created_at: new Date().toISOString(),
                                sender_type: 'customer',
                                ticket_id: ensuredTicket.id
                            },
                            customer: { phone_number: message.from }
                        });

                        // If a new ticket was created, broadcast it as a card
                        if (result.message && /ticket.*created/i.test(result.message)) {
                            socketService.broadcastToAgents('newTicket', ensuredTicket);
                        }
                    }
                    // Otherwise, suppress broadcasts during pre-ticket WhatsApp-only flow
                }
            } catch (error) {
                console.error(`Error processing message from ${message.from}:`, error);
                results.push({
                    from: message.from,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log('Enhanced webhook processing results:', results);
        res.status(200).json({ 
            status: 'success', 
            message: 'Messages processed',
            results: results
        });

    } catch (error) {
        console.error('Enhanced webhook error:', error);
        res.status(500).json({ 
            status: 'error', 
            message: 'Internal server error',
            error: error.message 
        });
    }
});

// Test endpoint for creating tickets via API
router.post('/test-create-ticket', async (req, res) => {
    try {
        const { phone_number, ticket_type, form_data } = req.body;
        
        if (!phone_number || !ticket_type) {
            return res.status(400).json({
                success: false,
                error: 'phone_number and ticket_type are required'
            });
        }

        console.log(`Test creating ticket for ${phone_number}, type: ${ticket_type}`);

        // Prepare ticket data
        const ticketData = {
            phone_number: phone_number,
            issue_type: ticket_type,
            ...form_data
        };

        const result = await enhancedTicketService.createTicket(ticketData);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Ticket created successfully',
                ticket: result.ticket
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Test create ticket error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get conversation state for a phone number
router.get('/conversation-state/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        const stateResult = await enhancedTicketService.conversationStateService.getState(phoneNumber);
        
        if (stateResult.success) {
            res.status(200).json({
                success: true,
                state: stateResult.data
            });
        } else {
            res.status(400).json({
                success: false,
                error: stateResult.error
            });
        }

    } catch (error) {
        console.error('Get conversation state error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Clear conversation state for a phone number
router.delete('/conversation-state/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        const result = await enhancedTicketService.conversationStateService.clearState(phoneNumber);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Conversation state cleared'
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Clear conversation state error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get open tickets for a phone number
router.get('/open-tickets/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        const result = await enhancedTicketService.checkOpenTickets(phoneNumber);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                hasOpenTickets: result.hasOpenTickets,
                tickets: result.tickets
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Get open tickets error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send test message to WhatsApp
router.post('/send-test-message', async (req, res) => {
    try {
        const { phone_number, message } = req.body;
        
        if (!phone_number || !message) {
            return res.status(400).json({
                success: false,
                error: 'phone_number and message are required'
            });
        }

        console.log(`Sending test message to ${phone_number}: ${message}`);

        const result = await whatsappService.sendMessage(phone_number, message);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'Message sent successfully',
                whatsapp_message_id: result.messageId
            });
        } else {
            res.status(400).json({
                success: false,
                error: result.error
            });
        }

    } catch (error) {
        console.error('Send test message error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
