const { executeQuery, executeTransaction } = require('../config/database');
const { v4: uuidv4 } = require('uuid');

class Ticket {
    constructor(data) {
        this.id = data.id;
        this.ticket_number = data.ticket_number;
        this.customer_id = data.customer_id;
        // Ensure phone_number is available when joined with customers
        this.phone_number = data.phone_number;
        this.customer_name = data.customer_name;
        this.assigned_agent_id = data.assigned_agent_id;
        this.status = data.status;
        this.priority = data.priority;
        this.issue_type = data.issue_type;
        this.vehicle_number = data.vehicle_number;
        this.driver_number = data.driver_number;
        this.location = data.location;
        this.availability_date = data.availability_date;
        this.availability_time = data.availability_time;
        this.comment = data.comment;
        this.escalation_time = data.escalation_time;
        this.escalated_to_senior_id = data.escalated_to_senior_id;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Generate unique ticket number
    static generateTicketNumber() {
        const timestamp = Date.now().toString().slice(-6);
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        return `TKT-${timestamp}-${random}`;
    }

    // Create new ticket
    static async create(ticketData) {
        const ticketNumber = this.generateTicketNumber();
        
        const query = `
            INSERT INTO tickets (
                ticket_number, customer_id, assigned_agent_id, status, priority,
                issue_type, vehicle_number, driver_number, location,
                availability_date, availability_time, comment
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            ticketNumber,
            ticketData.customer_id,
            ticketData.assigned_agent_id || null,
            ticketData.status || 'open',
            ticketData.priority || 'medium',
            ticketData.issue_type,
            ticketData.vehicle_number || null,
            ticketData.driver_number || null,
            ticketData.location || null,
            ticketData.availability_date || null,
            ticketData.availability_time || null,
            ticketData.comment || null
        ];

        const result = await executeQuery(query, params);
        
        if (result.success) {
            const created = await this.findById(result.data.insertId);
            return { success: true, data: created };
        }
        
        return { success: false, error: result.error };
    }

    // Find ticket by ID
    static async findById(id) {
        const query = `
            SELECT t.*, c.phone_number, c.name as customer_name,
                   u.name as assigned_agent_name
            FROM tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.assigned_agent_id = u.id
            WHERE t.id = ?
        `;
        
        const result = await executeQuery(query, [id]);
        
        if (result.success && result.data.length > 0) {
            return new Ticket(result.data[0]);
        }
        
        return null;
    }

    // Find open ticket by customer phone number
    static async findOpenTicketByPhone(phoneNumber) {
        const query = `
            SELECT t.*, c.phone_number, c.name as customer_name,
                   u.name as assigned_agent_name
            FROM tickets t
            LEFT JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON t.assigned_agent_id = u.id
            WHERE c.phone_number = ? AND t.status IN ('open', 'in_progress', 'pending_customer')
            ORDER BY t.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            return new Ticket(result.data[0]);
        }
        
        return null;
    }

    // Get all tickets with pagination
    static async getAll(page = 1, limit = 20, status = null) {
        // ensure numbers
        page = Number(page) || 1;
        limit = Number(limit) || 20;
      
        const offset = (page - 1) * limit;
      
        let query = `
          SELECT t.*, c.phone_number, c.name as customer_name,
                 u.name as assigned_agent_name
          FROM tickets t
          LEFT JOIN customers c ON t.customer_id = c.id
          LEFT JOIN users u ON t.assigned_agent_id = u.id
        `;
      
        const params = [];
      
        if (status) {
          query += ' WHERE t.status = ?';
          params.push(status);
        }
      
        query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
      
        // make sure executeQuery forwards params correctly
        const result = await executeQuery(query, params); 
        return result;
      }

    // Update ticket status
    async updateStatus(status, agentId = null) {
        const query = `
            UPDATE tickets 
            SET status = ?, assigned_agent_id = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `;
        
        const result = await executeQuery(query, [status, agentId || this.assigned_agent_id, this.id]);
        
        if (result.success) {
            this.status = status;
            if (agentId) this.assigned_agent_id = agentId;
        }
        
        return result;
    }

    // Assign ticket to agent
    async assignToAgent(agentId) {
        return await this.updateStatus('in_progress', agentId);
    }

    // Close ticket
    async close() {
        return await this.updateStatus('closed');
    }

    // Get ticket messages
    async getMessages() {
        const query = `
            SELECT m.*, u.name as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = ?
            ORDER BY m.created_at ASC
        `;
        
        const result = await executeQuery(query, [this.id]);
        return result;
    }

    // Add message to ticket
    async addMessage(messageData) {
        const query = `
            INSERT INTO messages (
                ticket_id, sender_type, sender_id, message_text,
                message_type, media_url, is_from_whatsapp, whatsapp_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            this.id,
            messageData.sender_type,
            messageData.sender_id || null,
            messageData.message_text,
            messageData.message_type || 'text',
            messageData.media_url || null,
            messageData.is_from_whatsapp || false,
            messageData.whatsapp_message_id || null
        ];

        const result = await executeQuery(query, params);
        
        if (result.success) {
            return await this.getMessages();
        }
        
        return result;
    }

    // Check if ticket needs escalation
    async checkEscalation() {
        const query = `
            SELECT m.created_at
            FROM messages m
            WHERE m.ticket_id = ? AND m.sender_type = 'customer'
            ORDER BY m.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [this.id]);
        
        if (result.success && result.data.length > 0) {
            const lastCustomerMessage = new Date(result.data[0].created_at);
            const now = new Date();
            const timeDiff = (now - lastCustomerMessage) / (1000 * 60); // minutes
            
            // If no agent response in 5-10 minutes, escalate
            if (timeDiff >= 5 && this.status !== 'closed') {
                return { needsEscalation: true, timeDiff };
            }
        }
        
        return { needsEscalation: false };
    }
}

module.exports = Ticket;
