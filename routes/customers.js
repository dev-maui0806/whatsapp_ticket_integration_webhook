const express = require('express');
const router = express.Router();
const Customer = require('../models/Customer');
const Message = require('../models/Message');
const Ticket = require('../models/Ticket');
const { executeQuery } = require('../config/database');

// Get all customers with statistics
router.get('/', async (req, res) => {
    try {
        const result = await Customer.getAllWithStats();
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error fetching customers:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get customer by phone number
router.get('/phone/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        const result = await Customer.findByPhoneWithStats(phoneNumber);
        
        if (result) {
            res.status(200).json({
                success: true,
                data: result
            });
        } else {
            res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
    } catch (error) {
        console.error('Error fetching customer:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get customer messages
router.get('/:phoneNumber/messages', async (req, res) => {
    try {
        console.log(req.params)
        const { phoneNumber } = req.params;
        // Support pagination windowing and sort order
        // mode: latest window (default) order=DESC with limit/offset over latest
        const { limit = 50, offset = 0, order = 'DESC' } = req.query;
        
        const result = await Message.getByPhoneNumber(
            phoneNumber,
            parseInt(limit),
            parseInt(offset),
            order
        );
        console.log("*******reslt********", result);
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error fetching customer messages:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Send message to customer
router.post('/:phoneNumber/message', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const { message, agent_id = 1 } = req.body;
        
        if (!message) {
            return res.status(400).json({
                success: false,
                error: 'Message is required'
            });
        }
        
        // Save message to database
        const messageData = {
            phone_number: phoneNumber,
            sender_type: 'agent',
            sender_id: agent_id,
            message_text: message,
            message_type: 'text',
            is_from_whatsapp: false
        };
        
        const result = await Message.create(messageData);
        
        if (result.success) {
            // Send message via WhatsApp
            const whatsappService = req.app.get('whatsappService');
            if (whatsappService) {
                const whatsappResult = await whatsappService.sendMessage(phoneNumber, message);
                console.log('***************WhatsApp send result:', whatsappResult);
            }
            
            // Broadcast to socket clients
            const socketService = req.app.get('socketService');
            if (socketService) {
                socketService.broadcastToAgents('messageSent', {
                    success: true,
                    message: result.data,
                    customer: { phone_number: phoneNumber }
                });
            }
            
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error sending message to customer:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get customer tickets
router.get('/:phoneNumber/tickets', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        
        // Find customer first
        const customer = await Customer.findByPhone(phoneNumber);
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        const result = await customer.getTickets();
        
        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error fetching customer tickets:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Create new ticket for customer
router.post('/:phoneNumber/tickets', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const ticketData = req.body;
        
        // Find or create customer
        const customerResult = await Customer.findOrCreate(phoneNumber, ticketData.customer_name);
        if (!customerResult.success) {
            return res.status(500).json({
                success: false,
                error: 'Failed to create customer'
            });
        }
        
        const customer = customerResult.data;
        
        // Create ticket
        const ticketCreateData = {
            customer_id: customer.id,
            issue_type: ticketData.issue_type,
            vehicle_number: ticketData.vehicle_number,
            driver_number: ticketData.driver_number,
            location: ticketData.location,
            comment: ticketData.comment,
            status: 'open',
            priority: 'medium'
        };
        
        const result = await Ticket.create(ticketCreateData);
        
        if (result.success) {
            res.status(201).json({
                success: true,
                data: result.data
            });
        } else {
            res.status(500).json({
                success: false,
                error: result.error
            });
        }
    } catch (error) {
        console.error('Error creating ticket for customer:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Update customer information
router.patch('/:phoneNumber', async (req, res) => {
    try {
        const { phoneNumber } = req.params;
        const updateData = req.body;
        
        const customer = await Customer.findByPhone(phoneNumber);
        if (!customer) {
            return res.status(404).json({
                success: false,
                error: 'Customer not found'
            });
        }
        
        if (updateData.name) {
            await customer.updateName(updateData.name);
        }
        
        res.status(200).json({
            success: true,
            data: customer
        });
    } catch (error) {
        console.error('Error updating customer:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
