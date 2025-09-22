const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const Customer = require('../models/Customer');
const Message = require('../models/Message');
const TicketService = require('../services/ticketService');

// Initialize service
const ticketService = new TicketService();

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
        const agentName = req.body.agentName || 'Agent'; // Get agent name from request body
        
        if (isNaN(ticketId)) {
            return res.status(400).json({ error: 'Invalid ticket ID' });
        }

        const ticket = await Ticket.findById(ticketId);
        
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Close the ticket
        const result = await ticket.close();
        
        if (result.success) {
            // Import required services
            const whatsappService = require('../services/whatsappService');
            const botConversationService = require('../services/botConversationService');
            
            // Send WhatsApp notification to customer
            const notificationMessage = `This ticket ${ticket.ticket_number} has been closed by agent ${agentName}.`;
            try {
                await whatsappService.sendMessage(ticket.phone_number, notificationMessage);
                console.log(`WhatsApp notification sent to ${ticket.phone_number}: ${notificationMessage}`);
            } catch (whatsappError) {
                console.error('Failed to send WhatsApp notification:', whatsappError);
                // Don't fail the ticket closing if WhatsApp notification fails
            }
            
            // Update conversation state to CLOSE if there's an active conversation
            try {
                await botConversationService.updateConversationState(
                    ticket.phone_number, 
                    'CLOSE', 
                    null, 
                    {}, 
                    ticketId, 
                    'null'
                );
                console.log(`Conversation state updated to CLOSE for phone ${ticket.phone_number}`);
            } catch (conversationError) {
                console.error('Failed to update conversation state:', conversationError);
                // Don't fail the ticket closing if conversation state update fails
            }
            
            res.status(200).json({
                success: true,
                data: await Ticket.findById(ticketId),
                message: 'Ticket closed successfully with notifications sent'
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
