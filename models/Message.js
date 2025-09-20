const { executeQuery } = require('../config/database');

class Message {
    constructor(data) {
        this.id = data.id;
        this.ticket_id = data.ticket_id;
        this.phone_number = data.phone_number;
        this.sender_type = data.sender_type;
        this.sender_id = data.sender_id;
        this.message_text = data.message_text;
        this.message_type = data.message_type;
        this.media_url = data.media_url;
        this.is_from_whatsapp = data.is_from_whatsapp;
        this.whatsapp_message_id = data.whatsapp_message_id;
        this.created_at = data.created_at;
    }

    // Create new message
    static async create(messageData) {
        const query = `
            INSERT INTO messages (
                ticket_id, phone_number, sender_type, sender_id, message_text,
                message_type, media_url, is_from_whatsapp, whatsapp_message_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const params = [
            messageData.ticket_id || null,
            messageData.phone_number || null,
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
            const created = await this.findById(result.data.insertId);
            return { success: true, data: created };
        }
        
        return { success: false, error: result.error };
    }

    // Find message by ID
    static async findById(id) {
        const query = `
            SELECT m.*, u.name as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        `;
        
        const result = await executeQuery(query, [id]);
        
        if (result.success && result.data.length > 0) {
            return new Message(result.data[0]);
        }
        
        return null;
    }

    // find messages for a ticket
    static async getByTicketId(ticketId, limit = 50, offset = 0) {
        const query = `
            SELECT m.*, u.name as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = ?
            ORDER BY m.created_at ASC
        `;
        
        const result = await executeQuery(query, [ticketId]);
        return result;
    }

    // find latest message for a ticket
    static async getLatestByTicketId(ticketId) {
        const query = `
            SELECT m.*, u.name as sender_name
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.ticket_id = ?
            ORDER BY m.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [ticketId]);
        
        if (result.success && result.data.length > 0) {
            return new Message(result.data[0]);
        }
        
        return null;
    }

    // Get unread messages for agents
    static async getUnreadForAgents() {
        const query = `
            SELECT m.*, t.ticket_number, c.phone_number, c.name as customer_name,
                   u.name as sender_name
            FROM messages m
            JOIN tickets t ON m.ticket_id = t.id
            JOIN customers c ON t.customer_id = c.id
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE m.sender_type = 'customer' 
            AND m.created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            ORDER BY m.created_at DESC
        `;
        
        const result = await executeQuery(query);
        return result;
    }

    // Get messages by phone number
    static async getByPhoneNumber(phoneNumber, limit = 50, offset = 0) {
        console.log("#######phoneNumber########", phoneNumber)
        const query = `
            SELECT m.*, m.sender_type
            FROM messages m
            WHERE m.phone_number = ?
            ORDER BY m.created_at ASC
        `;
        
        const result = await executeQuery(query, [phoneNumber, limit, offset]);
        return result;
    }

    // Get latest message by phone number
    static async getLatestByPhoneNumber(phoneNumber) {
        const query = `
            SELECT m.*, u.name as sender_name, t.ticket_number
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN tickets t ON m.ticket_id = t.id
            WHERE m.phone_number = ?
            ORDER BY m.created_at DESC
            LIMIT 1
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            return new Message(result.data[0]);
        }
        
        return null;
    }

    // find unread messages count for phone number
    static async getUnreadCountByPhoneNumber(phoneNumber) {
        const query = `
            SELECT COUNT(*) as count
            FROM messages m
            WHERE m.phone_number = ? 
            AND m.sender_type = 'customer'
            AND m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            return result.data[0].count;
        }
        
        return 0;
    }

    // Mark message as processed
    async markAsProcessed() {
        // This could be extended to track message processing status
        return { success: true };
    }
}

module.exports = Message;
