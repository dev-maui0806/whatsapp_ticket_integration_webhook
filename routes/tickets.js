const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Customer = require('../models/Customer');
const Message = require('../models/Message');
const TicketService = require('../services/ticketService');
const { executeQuery } = require('../config/database');
const WhatsAppService = require('../services/whatsappService');

// Initialize service
const ticketService = new TicketService();
const whatsappService = new WhatsAppService();
// Get all tickets with pagination and filters
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const status = req.query.status || null;

        const result = await Ticket.getAll(page, limit, status);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                page: page,
                limit: limit,
                total: result.data.length
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error fetching tickets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get ticket by ID
router.get('/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (ticket) {
            const messages = await ticket.getMessages();
            
            res.status(200).json({
                success: true,
                data: {
                    ticket: ticket,
                    messages: messages.success ? messages.data : []
                }
            });
        } else {
            res.status(404).json({ error: 'Ticket not found' });
        }
    } catch (error) {
        console.error('Error fetching ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get tickets by customer phone number
router.get('/customer/:phoneNumber', async (req, res) => {
    try {
        const phoneNumber = req.params.phoneNumber;
        
        const customer = await Customer.findByPhone(phoneNumber);
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }

        const tickets = await customer.getTickets();
        
        res.status(200).json({
            success: true,
            data: {
                customer: customer,
                tickets: tickets.success ? tickets.data : []
            }
        });
    } catch (error) {
        console.error('Error fetching customer tickets:', error);
        res.status(500).json({ error: error.message });
    }
});

// Create new ticket
router.post('/', async (req, res) => {
    try {
        const ticketData = req.body;
        
        // Validate required fields
        if (!ticketData.customer_id || !ticketData.issue_type) {
            return res.status(400).json({ 
                error: 'Customer ID and issue type are required' 
            });
        }

        const result = await Ticket.create(ticketData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Update ticket status
router.patch('/:id/status', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { status, agent_id } = req.body;
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const result = await ticket.updateStatus(status, agent_id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: await Ticket.findById(ticketId)
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error updating ticket status:', error);
        res.status(500).json({ error: error.message });
    }
});

// Assign ticket to agent
router.patch('/:id/assign', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { agent_id } = req.body;
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        if (!agent_id) {
            return res.status(400).json({ error: 'Agent ID is required' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const result = await ticket.assignToAgent(agent_id);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: await Ticket.findById(ticketId)
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error assigning ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Send agent reply
router.post('/:id/reply', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { agent_id, message } = req.body;
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        if (!agent_id || !message) {
            return res.status(400).json({ 
                error: 'Agent ID and message are required' 
            });
        }

        const result = await ticketService.sendAgentReply(ticketId, agent_id, message);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error sending agent reply:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get ticket messages
router.get('/:id/messages', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        const result = await Message.getByTicketId(ticketId, limit, offset);
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error fetching ticket messages:', error);
        res.status(500).json({ error: error.message });
    }
});

// Close ticket
router.patch('/:id/close', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        console.log('**********ticketId', ticketId)
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Check if ticket is already closed
        if (ticket.status === 'closed') {
            return res.status(400).json({ error: 'Ticket is already closed' });
        }

        // Close the ticket
        const result = await ticket.close();
        
        if (result.success) {
            // Get customer phone number for WhatsApp notification
            const customerQuery = `
                SELECT c.phone_number, c.name as customer_name
                FROM customers c
                JOIN tickets t ON c.id = t.customer_id
                WHERE t.id = ?
            `;
            const customerResult = await executeQuery(customerQuery, [ticketId]);
            
            if (customerResult.success && customerResult.data.length > 0) {
                const customer = customerResult.data[0];
                const phoneNumber = customer.phone_number;
                const customerName = customer.customer_name || 'Customer';
                
                // Send WhatsApp notification to customer
                console.log('**********phoneNumber', phoneNumber)
                if (whatsappService && phoneNumber) {
                    const notificationMessage = `Ticket ${ticket.ticket_number || `#${ticketId}`} has been closed.`;
                    console.log(`📱 Sending ticket closure notification to ${phoneNumber}: ${notificationMessage}`);
                    
                    try {
                        const whatsappResult = await whatsappService.sendMessage(phoneNumber, notificationMessage);
                        console.log('✅ WhatsApp notification sent:', whatsappResult);
                        
                        // Save the notification message to database
                        const messageData = {
                            phone_number: phoneNumber,
                            ticket_id: ticketId,
                            sender_type: 'system',
                            sender_id: null,
                            message_text: notificationMessage,
                            message_type: 'text',
                            // Outbound message from our system → not from WhatsApp
                            is_from_whatsapp: false,
                            whatsapp_message_id: whatsappResult?.messageId || null
                        };
                        await Message.create(messageData);
                        
                    } catch (whatsappError) {
                        console.error('❌ Failed to send WhatsApp notification:', whatsappError);
                        // Continue with ticket closure even if WhatsApp fails
                    }
                }
            }
            
            // Update conversation state to CLOSE and clear ticket data
            try {
                // Resolve phone number first
                const phoneRes = await executeQuery(
                    `SELECT c.phone_number FROM customers c JOIN tickets t ON c.id = t.customer_id WHERE t.id = ? LIMIT 1`,
                    [ticketId]
                );
                const phoneNum = phoneRes.success && phoneRes.data.length ? phoneRes.data[0].phone_number : null;

                if (phoneNum) {
                    // Upsert by phone number
                    const upsertQuery = `
                        INSERT INTO bot_conversation_states (phone_number, current_step, ticket_type, form_data, current_ticket_id, automation_chat_state)
                        VALUES (?, 'CLOSE', NULL, '{}', NULL, NULL)
                        ON DUPLICATE KEY UPDATE
                            current_step = 'CLOSE',
                            ticket_type = NULL,
                            form_data = '{}',
                            current_ticket_id = NULL,
                            automation_chat_state = NULL,
                            updated_at = CURRENT_TIMESTAMP
                    `;
                    await executeQuery(upsertQuery, [phoneNum]);

                    // Also clear any row that still references this ticket id just in case
                    const clearByTicketQuery = `
                        UPDATE bot_conversation_states
                        SET current_step = 'CLOSE', ticket_type = NULL, form_data = '{}', current_ticket_id = NULL, automation_chat_state = NULL, updated_at = CURRENT_TIMESTAMP
                        WHERE current_ticket_id = ?
                    `;
                    await executeQuery(clearByTicketQuery, [ticketId]);

                    console.log('✅ Conversation state updated to CLOSE for phone:', phoneNum, 'ticket:', ticketId);
                } else {
                    console.warn('⚠️ Could not resolve phone number for ticket when updating conversation state:', ticketId);
                }
            } catch (conversationError) {
                console.error('❌ Failed to update conversation state:', conversationError);
                // Continue with ticket closure even if conversation state update fails
            }
            
            // Get updated ticket data
            const updatedTicket = await Ticket.findById(ticketId);
            
            // Broadcast socket events to agents for realtime dashboards
            try {
                const socketService = req.app.get('socketService');
                if (socketService) {
                    // Notify all agents a ticket has been updated
                    socketService.broadcastToAgents('ticketUpdated', { ticket: updatedTicket });
                    // Also send a semantic agent action event
                    socketService.broadcastToAgents('agentActionCompleted', {
                        action: 'close',
                        ticket: updatedTicket,
                        agentId: req.body?.agent_id || null
                    });
                }
            } catch (e) {
                console.warn('⚠️ Socket broadcast failed (close):', e.message);
            }
            
            res.status(200).json({
                success: true,
                data: updatedTicket
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error closing ticket:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get escalations
router.get('/escalations/check', async (req, res) => {
    try {
        const result = await ticketService.checkEscalations();
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.escalations
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error checking escalations:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
