const Ticket = require('../models/Ticket');
const Customer = require('../models/Customer');
const Message = require('../models/Message');
const WhatsAppService = require('./whatsappService');

class TicketService {
    constructor() {
        this.whatsappService = new WhatsAppService();
    }

    // Process incoming WhatsApp message
    async processIncomingMessage(whatsappMessage) {
        try {
            const phoneNumber = this.whatsappService.formatPhoneNumber(whatsappMessage.from);
            const messageText = whatsappMessage.text || '';
            
            console.log(`Processing message from ${phoneNumber}: ${messageText}`);

            // Find or create customer
            const customer = await Customer.findOrCreate(phoneNumber);
            if (!customer.success) {
                return { success: false, error: 'Failed to create customer' };
            }

            // Check for existing open ticket first
            const existingTicket = await Ticket.findOpenTicketByPhone(phoneNumber);
            
            if (existingTicket) {
                // Check if message contains complete ticket information
                const ticketInfo = this.extractTicketInfo(messageText);
                
                // If message contains complete ticket details, update the existing ticket
                if (ticketInfo.isComplete) {
                    console.log('Message contains complete ticket info, updating existing ticket');
                    return await this.updateTicketWithDetails(existingTicket, customer.data, ticketInfo, messageText, whatsappMessage);
                } else {
                    // For incomplete messages, add to existing ticket
                    return await this.handleExistingTicket(existingTicket, customer.data, messageText, whatsappMessage);
                }
            } else {
                // No existing ticket, create new one
                return await this.handleNewTicket(customer.data, messageText, whatsappMessage);
            }
        } catch (error) {
            console.error('Error processing incoming message:', error);
            return { success: false, error: error.message };
        }
    }

    // Update existing ticket with complete details
    async updateTicketWithDetails(ticket, customer, ticketInfo, messageText, whatsappMessage) {
        try {
            // Update the existing ticket with parsed information
            const updateQuery = `
                UPDATE tickets SET 
                    issue_type = ?,
                    vehicle_number = ?,
                    driver_number = ?,
                    location = ?,
                    availability_date = ?,
                    availability_time = ?,
                    comment = ?,
                    status = 'in_progress',
                    updated_at = NOW()
                WHERE id = ?
            `;
            
            const { executeQuery } = require('../config/database');
            const result = await executeQuery(updateQuery, [
                ticketInfo.issue_type,
                ticketInfo.vehicle_number,
                ticketInfo.driver_number,
                ticketInfo.location,
                ticketInfo.availability_date,
                ticketInfo.availability_time,
                ticketInfo.comment,
                ticket.id
            ]);

            if (!result.success) {
                return { success: false, error: 'Failed to update ticket' };
            }

            // Add the detailed message to the ticket
            const messageData = {
                ticket_id: ticket.id,
                sender_type: 'customer',
                message_text: messageText,
                is_from_whatsapp: true,
                whatsapp_message_id: whatsappMessage.id
            };

            const messageResult = await Message.create(messageData);
            
            if (!messageResult.success) {
                return { success: false, error: 'Failed to save message' };
            }

            // Send confirmation message
            const confirmationMessage = `Thank you for providing the complete details! Your ticket #${ticket.ticket_number} has been updated with:
- Vehicle: ${ticketInfo.vehicle_number}
- Driver: ${ticketInfo.driver_number}
- Location: ${ticketInfo.location}
- Date: ${ticketInfo.availability_date}
- Time: ${ticketInfo.availability_time}

An agent will contact you shortly.`;

            const whatsappResult = await this.whatsappService.sendMessage(
                customer.phone_number,
                confirmationMessage
            );

            return {
                success: true,
                ticket: ticket,
                customer: customer,
                message: messageResult.data,
                whatsappResponse: whatsappResult,
                updated: true
            };
        } catch (error) {
            console.error('Error updating ticket with details:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle message for existing ticket
    async handleExistingTicket(ticket, customer, messageText, whatsappMessage) {
        try {
            // Add message to existing ticket
            const messageData = {
                ticket_id: ticket.id,
                sender_type: 'customer',
                message_text: messageText,
                is_from_whatsapp: true,
                whatsapp_message_id: whatsappMessage.id
            };

            const messageResult = await Message.create(messageData);
            
            if (!messageResult.success) {
                return { success: false, error: 'Failed to save message' };
            }

            // Update ticket status to pending_customer if it was closed
            if (ticket.status === 'closed') {
                await ticket.updateStatus('pending_customer');
            }

            // Send acknowledgment message
            const acknowledgmentMessage = `Thank you for your message. Your ticket #${ticket.ticket_number} has been updated. An agent will respond shortly.`;
            
            const whatsappResult = await this.whatsappService.sendMessage(
                customer.phone_number,
                acknowledgmentMessage
            );

            return {
                success: true,
                ticket: ticket,
                customer: customer,
                message: messageResult.data,
                whatsappResponse: whatsappResult
            };
        } catch (error) {
            console.error('Error handling existing ticket:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle new ticket creation
    async handleNewTicket(customer, messageText, whatsappMessage) {
        try {
            // Check if message contains ticket information
            const ticketInfo = this.extractTicketInfo(messageText);
            
            // Decide ticket payload: complete info or minimal placeholder
            const ticketData = ticketInfo.isComplete ? {
                customer_id: customer.id,
                issue_type: ticketInfo.issue_type,
                vehicle_number: ticketInfo.vehicle_number,
                driver_number: ticketInfo.driver_number,
                location: ticketInfo.location,
                availability_date: ticketInfo.availability_date,
                availability_time: ticketInfo.availability_time,
                comment: ticketInfo.comment
            } : {
                customer_id: customer.id,
                issue_type: 'other',
                comment: messageText
            };

            const ticketResult = await Ticket.create(ticketData);
            if (!ticketResult.success) {
                return { success: false, error: 'Failed to create ticket' };
            }

            const ticket = ticketResult.data;

            // Always store the incoming message
            const messageData = {
                ticket_id: ticket.id,
                sender_type: 'customer',
                message_text: messageText,
                is_from_whatsapp: true,
                whatsapp_message_id: whatsappMessage.id
            };
            await Message.create(messageData);

            // If incomplete info, guide the user next
            if (!ticketInfo.isComplete) {
                const interactive = await this.sendTicketCollectionMessage(customer);
                return {
                    success: true,
                    ticket: ticket,
                    customer: customer,
                    nextStep: 'collect_issue_type',
                    whatsappResponse: interactive
                };
            }

            // If complete, send confirmation
            const confirmationMessage = `Your ticket #${ticket.ticket_number} has been created successfully. An agent will contact you shortly.`;
            const whatsappResult = await this.whatsappService.sendMessage(
                customer.phone_number,
                confirmationMessage
            );

            return {
                success: true,
                ticket: ticket,
                customer: customer,
                whatsappResponse: whatsappResult
            };
        } catch (error) {
            console.error('Error handling new ticket:', error);
            return { success: false, error: error.message };
        }
    }

    // Send interactive message to collect ticket information
    async sendTicketCollectionMessage(customer) {
        try {
            const buttons = [
                { id: 'lock_open', title: 'Lock Open' },
                { id: 'repair', title: 'Repair' },
                { id: 'vehicle_status', title: 'Vehicle Status' },
                { id: 'other', title: 'Other' }
            ];

            const result = await this.whatsappService.sendInteractiveMessage(
                customer.phone_number,
                'Welcome to our Support System',
                'Please select the type of service you need:',
                'Choose an option below',
                buttons
            );

            return {
                success: true,
                customer: customer,
                whatsappResponse: result,
                nextStep: 'collect_issue_type'
            };
        } catch (error) {
            console.error('Error sending ticket collection message:', error);
            return { success: false, error: error.message };
        }
    }

    // Extract ticket information from message text
    extractTicketInfo(messageText) {
        const info = {
            isComplete: false,
            issue_type: null,
            vehicle_number: null,
            driver_number: null,
            location: null,
            availability_date: null,
            availability_time: null,
            comment: null
        };

        const text = messageText.trim();
        console.log('Extracting ticket info from:', text);

        // Handle comma-separated format: "Vehicle: ABC123, Driver: XYZ789, Location: Warsaw"
        // Split by comma first, then parse each part
        const parts = text.split(',').map(part => part.trim());
        
        for (const part of parts) {
            const lowerPart = part.toLowerCase();
            
            // Vehicle parsing
            if (lowerPart.startsWith('vehicle:') || lowerPart.startsWith('car:') || lowerPart.startsWith('bike:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.vehicle_number = match[1].trim();
                    console.log('Found vehicle:', info.vehicle_number);
                }
            }
            
            // Driver parsing
            if (lowerPart.startsWith('driver:') || lowerPart.startsWith('license:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.driver_number = match[1].trim();
                    console.log('Found driver:', info.driver_number);
                }
            }
            
            // Location parsing
            if (lowerPart.startsWith('location:') || lowerPart.startsWith('address:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.location = match[1].trim();
                    console.log('Found location:', info.location);
                }
            }
            
            // Date parsing
            if (lowerPart.startsWith('date:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.availability_date = match[1].trim();
                    console.log('Found date:', info.availability_date);
                }
            }
            
            // Time parsing
            if (lowerPart.startsWith('time:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.availability_time = match[1].trim();
                    console.log('Found time:', info.availability_time);
                }
            }
            
            // Comment parsing
            if (lowerPart.startsWith('comment:')) {
                const match = part.match(/^[^:]+:\s*(.+)$/i);
                if (match) {
                    info.comment = match[1].trim();
                    console.log('Found comment:', info.comment);
                }
            }
        }

        // Infer issue type by keywords if present
        const lower = text.toLowerCase();
        if (lower.includes('lock')) info.issue_type = 'lock_open';
        else if (lower.includes('repair')) info.issue_type = 'repair';
        else if (lower.includes('status')) info.issue_type = 'vehicle_status';
        else info.issue_type = 'other';

        // Determine completeness (vehicle/driver/location are enough)
        if (info.vehicle_number && info.driver_number && info.location) {
            info.isComplete = true;
            if (!info.comment) {
                info.comment = messageText; // Use full message as comment if no specific comment found
            }
        }

        console.log('Extracted ticket info:', info);
        return info;
    }

    // Send agent reply to customer
    async sendAgentReply(ticketId, agentId, messageText) {
        try {
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            // Validate agent exists (soft validation to avoid blocking messaging in demos)
            const { executeQuery } = require('../config/database');
            let agent = { id: agentId, name: 'Agent', email: '' };
            try {
                console.log(`Validating agent ID: ${agentId}`);
                const agentResult = await executeQuery('SELECT * FROM users WHERE id = ?', [agentId]);
                if (agentResult.success && agentResult.data.length > 0) {
                    agent = agentResult.data[0];
                    console.log(`Agent found: ${agent.name} (${agent.email})`);
                } else {
                    console.warn(`Agent not found for ID: ${agentId}. Proceeding without strict validation.`);
                }
            } catch (e) {
                console.warn('Agent validation query failed, proceeding:', e.message);
            }

            // Add agent message to ticket
            const messageData = {
                ticket_id: ticketId,
                sender_type: 'agent',
                sender_id: agentId,
                message_text: messageText,
                is_from_whatsapp: false
            };

            const messageResult = await Message.create(messageData);
            
            if (!messageResult.success) {
                return { success: false, error: 'Failed to save message' };
            }

            // Resolve customer's phone number reliably
            let destinationPhone = ticket.phone_number;
            if (!destinationPhone) {
                try {
                    const phoneQuery = `
                        SELECT c.phone_number
                        FROM tickets t
                        JOIN customers c ON c.id = t.customer_id
                        WHERE t.id = ?
                        LIMIT 1
                    `;
                    const phoneRes = await executeQuery(phoneQuery, [ticketId]);
                    if (phoneRes.success && phoneRes.data.length > 0) {
                        destinationPhone = phoneRes.data[0].phone_number;
                        // Also reflect on the ticket instance for future uses
                        ticket.phone_number = destinationPhone;
                    }
                } catch (e) {
                    console.warn('Fallback phone lookup failed:', e.message);
                }
            }

            if (!destinationPhone) {
                return { success: false, error: 'Customer phone number not found for this ticket' };
            }

            // Send message to customer via WhatsApp
            console.log(`Sending WhatsApp message to number ${destinationPhone} for ticket ${ticket.ticket_number || ticket.id}`);
            const whatsappResult = await this.whatsappService.sendMessage(
                destinationPhone,
                messageText
            );
            console.log(`WhatsApp result:`, whatsappResult);

            // Update ticket status
            await ticket.updateStatus('in_progress', agentId);

            return {
                success: true,
                ticket: ticket,
                message: messageResult.data,
                whatsappResponse: whatsappResult
            };
        } catch (error) {
            console.error('Error sending agent reply:', error);
            return { success: false, error: error.message };
        }
    }

    // Check for tickets needing escalation
    async checkEscalations() {
        try {
            const tickets = await Ticket.getAll(1, 100, 'in_progress');
            
            if (!tickets.success) {
                return { success: false, error: 'Failed to fetch tickets' };
            }

            const escalations = [];
            
            for (const ticketData of tickets.data) {
                const ticket = new Ticket(ticketData);
                const escalationCheck = await ticket.checkEscalation();
                
                if (escalationCheck.needsEscalation) {
                    escalations.push({
                        ticket: ticket,
                        timeDiff: escalationCheck.timeDiff
                    });
                }
            }

            return {
                success: true,
                escalations: escalations
            };
        } catch (error) {
            console.error('Error checking escalations:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = TicketService;
