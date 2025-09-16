const express = require('express');
const router = express.Router();

// Socket-based webhook endpoint for WhatsApp integration
router.post('/', async (req, res) => {
    try {
        console.log('📨 Received webhook (Socket mode):', JSON.stringify(req.body, null, 2));

        const io = req.app.get('io');
        const socketService = req.app.get('socketService');

        if (!io || !socketService) {
            console.error('❌ Socket service not available');
            return res.status(500).json({ 
                status: 'error', 
                error: 'Socket service not initialized' 
            });
        }

        // Log webhook data to database
        const { executeQuery } = require('../config/database');
        const logQuery = 'INSERT INTO webhook_logs (webhook_data) VALUES (?)';
        await executeQuery(logQuery, [JSON.stringify(req.body)]);

        // Process webhook data using WhatsAppService
        const WhatsAppService = require('../services/whatsappService');
        const whatsappService = new WhatsAppService();
        const messages = whatsappService.processWebhook(req.body);
        
        if (messages.length === 0) {
            console.log('No messages to process');
            return res.status(200).json({ status: 'success', message: 'No messages to process' });
        }

        // Process each message through Socket service
        const results = [];
        for (const message of messages) {
            console.log(`Processing message from ${message.from}: ${message.text}`);
            
            // Find customer by phone number
            const Customer = require('../models/Customer');
            const customerResult = await Customer.findOrCreate(message.from);
            
            if (customerResult.success) {
                const customer = customerResult.data;
                
                // Check if customer is connected via socket
                const customerSocket = io.sockets.adapter.rooms.get(`customer_${customer.id}`);
                
                if (customerSocket && customerSocket.size > 0) {
                    // Customer is connected via socket, process through socket
                    const socketMessage = {
                        messageText: message.text,
                        messageType: message.type || 'text',
                        whatsappMessageId: message.id
                    };
                    
                    // Find the customer's socket connection
                    const customerSockets = Array.from(customerSocket);
                    if (customerSockets.length > 0) {
                        const socketId = customerSockets[0];
                        const socket = io.sockets.sockets.get(socketId);
                        
                        if (socket) {
                            // Process message through socket
                            await socketService.handleCustomerMessage(socket, socketMessage);
                            results.push({
                                messageId: message.id,
                                from: message.from,
                                success: true,
                                method: 'socket'
                            });
                        }
                    }
                } else {
                    // Customer not connected via socket, process through traditional webhook
                    const TicketService = require('../services/ticketService');
                    const ticketService = new TicketService();
                    const result = await ticketService.processIncomingMessage(message);
                    
                    results.push({
                        messageId: message.id,
                        from: message.from,
                        success: result.success,
                        error: result.error || null,
                        method: 'webhook'
                    });

                    // If ticket was created/updated, notify agents via socket
                    if (result.success && result.ticket) {
                        socketService.broadcastToAgents('newCustomerMessage', {
                            ticket: result.ticket,
                            message: result.message,
                            customer: result.customer,
                            source: 'webhook'
                        });
                    }
                }
            } else {
                results.push({
                    messageId: message.id,
                    from: message.from,
                    success: false,
                    error: 'Failed to create customer',
                    method: 'webhook'
                });
            }
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
        const { executeQuery } = require('../config/database');
        const logQuery = 'INSERT INTO webhook_logs (webhook_data, processed, error_message) VALUES (?, ?, ?)';
        await executeQuery(logQuery, [JSON.stringify(req.body), false, error.message]);
        
        res.status(500).json({ 
            status: 'error', 
            error: error.message 
        });
    }
});

// Test endpoint to send a message via socket
router.post('/test-socket-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;
        
        if (!phoneNumber || !message) {
            return res.status(400).json({ 
                error: 'Phone number and message are required' 
            });
        }

        const io = req.app.get('io');
        const socketService = req.app.get('socketService');

        if (!io || !socketService) {
            return res.status(500).json({ 
                error: 'Socket service not available' 
            });
        }

        // Find customer by phone number
        const Customer = require('../models/Customer');
        const customerResult = await Customer.findOrCreate(phoneNumber);
        
        if (!customerResult.success) {
            return res.status(400).json({ 
                error: 'Failed to find or create customer' 
            });
        }

        const customer = customerResult.data;
        
        // Check if customer is connected via socket
        const customerSocket = io.sockets.adapter.rooms.get(`customer_${customer.id}`);
        
        if (customerSocket && customerSocket.size > 0) {
            // Send via socket
            socketService.sendToCustomer(customer.id, 'systemMessage', {
                type: 'test',
                message: message
            });
            
            res.status(200).json({
                success: true,
                method: 'socket',
                message: 'Message sent via socket'
            });
        } else {
            // Send via WhatsApp API
            const WhatsAppService = require('../services/whatsappService');
            const whatsappService = new WhatsAppService();
            const result = await whatsappService.sendMessage(phoneNumber, message);
            
            res.status(200).json({
                success: result.success,
                method: 'whatsapp',
                data: result.data,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Test socket message error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get active socket connections
router.get('/active-connections', (req, res) => {
    try {
        const socketService = req.app.get('socketService');
        
        if (!socketService) {
            return res.status(500).json({ 
                error: 'Socket service not available' 
            });
        }

        const activeConnections = socketService.getActiveConnections();
        const customerSessions = socketService.getCustomerSessions();
        const agentRooms = socketService.getAgentRooms();

        res.status(200).json({
            success: true,
            data: {
                activeConnections: activeConnections.length,
                customerSessions: customerSessions.length,
                agentRooms: agentRooms.length,
                connections: activeConnections,
                sessions: customerSessions,
                agents: agentRooms
            }
        });
    } catch (error) {
        console.error('Error getting active connections:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    const io = req.app.get('io');
    const socketService = req.app.get('socketService');
    
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        service: 'Socket Webhook Service',
        socketConnected: !!io,
        socketServiceAvailable: !!socketService
    });
});

module.exports = router;
