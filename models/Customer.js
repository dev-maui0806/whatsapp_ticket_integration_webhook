const { executeQuery } = require('../config/database');

class Customer {
    constructor(data) {
        this.id = data.id;
        this.phone_number = data.phone_number;
        this.name = data.name;
        this.created_at = data.created_at;
        this.updated_at = data.updated_at;
    }

    // Find customer by phone number
    static async findByPhone(phoneNumber) {
        const query = 'SELECT * FROM customers WHERE phone_number = ?';
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            return new Customer(result.data[0]);
        }
        
        return null;
    }

    // Create new customer
    static async create(customerData) {
        const query = `
            INSERT INTO customers (phone_number, name) 
            VALUES (?, ?)
        `;
        
        const params = [
            customerData.phone_number,
            customerData.name || null
        ];

        const result = await executeQuery(query, params);
        
        if (result.success) {
            const created = await this.findById(result.data.insertId);
            return { success: true, data: created };
        }
        
        return { success: false, error: result.error };
    }

    // Find customer by ID
    static async findById(id) {
        const query = 'SELECT * FROM customers WHERE id = ?';
        const result = await executeQuery(query, [id]);
        
        if (result.success && result.data.length > 0) {
            return new Customer(result.data[0]);
        }
        
        return null;
    }

    // Find or create customer by phone number
    static async findOrCreate(phoneNumber, name = null) {
        console.log(`[Customer.findOrCreate] Looking for customer with phone: ${phoneNumber}`);
        let customer = await this.findByPhone(phoneNumber);
        
        if (!customer) {
            console.log(`[Customer.findOrCreate] Customer not found, creating new one`);
            const createResult = await this.create({
                phone_number: phoneNumber,
                name: name
            });
            
            if (createResult.success) {
                customer = createResult.data;
                console.log(`[Customer.findOrCreate] Customer created successfully:`, customer);
            } else {
                console.log(`[Customer.findOrCreate] Customer creation failed:`, createResult.error);
                return createResult;
            }
        } else {
            console.log(`[Customer.findOrCreate] Customer found:`, customer);
        }
        
        const result = { success: true, data: customer };
        console.log(`[Customer.findOrCreate] Returning:`, result);
        return result;
    }

    // Update customer name
    async updateName(name) {
        const query = 'UPDATE customers SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
        const result = await executeQuery(query, [name, this.id]);
        
        if (result.success) {
            this.name = name;
        }
        
        return result;
    }

    // find customer tickets
    async getTickets(status = null) {
        let query = `
            SELECT t.*, u.name as assigned_agent_name
            FROM tickets t
            LEFT JOIN users u ON t.assigned_agent_id = u.id
            WHERE t.customer_id = ?
        `;
        
        const params = [this.id];
        
        if (status) {
            query += ' AND t.status = ?';
            params.push(status);
        } else {
            // By default, exclude closed tickets unless specifically requested
            query += ' AND t.status != ?';
            params.push('closed');
        }
        
        query += ' ORDER BY t.created_at DESC';

        const result = await executeQuery(query, params);
        return result;
    }

    // getphone open tickets count
    async getOpenTicketsCount() {
        const query = `
            SELECT COUNT(*) as count
            FROM tickets
            WHERE customer_id = ? AND status IN ('open', 'in_progress', 'pending_customer')
        `;
        
        const result = await executeQuery(query, [this.id]);
        
        if (result.success && result.data.length > 0) {
            return result.data[0].count;
        }
        
        return 0;
    }

    // getphone pending chats count (unread messages from customer)
    async getPendingChatsCount() {
        const query = `
            SELECT COUNT(*) as count
            FROM messages m
            WHERE m.phone_number = ? 
            AND m.sender_type = 'customer'
            AND m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
        `;
        
        const result = await executeQuery(query, [this.phone_number]);
        
        if (result.success && result.data.length > 0) {
            return result.data[0].count;
        }
        
        return 0;
    }

    // getphone all customers with their statistics
    static async getAllWithStats() {
        const query = `
            SELECT 
                c.id,
                c.phone_number,
                c.name,
                c.created_at,
                COUNT(DISTINCT CASE WHEN t.status IN ('open', 'in_progress', 'pending_customer') THEN t.id END) as open_tickets,
                COUNT(DISTINCT CASE WHEN m.sender_type = 'customer' AND m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN m.id END) as pending_chats
            FROM customers c
            LEFT JOIN tickets t ON c.id = t.customer_id
            LEFT JOIN messages m ON c.phone_number = m.phone_number
            GROUP BY c.id, c.phone_number, c.name, c.created_at
            ORDER BY c.created_at DESC
        `;
        
        const result = await executeQuery(query);
        return result;
    }

    // getphone customer by phone number with stats
    static async findByPhoneWithStats(phoneNumber) {
        const query = `
            SELECT 
                c.id,
                c.phone_number,
                c.name,
                c.created_at,
                COUNT(DISTINCT CASE WHEN t.status IN ('open', 'in_progress', 'pending_customer') THEN t.id END) as open_tickets,
                COUNT(DISTINCT CASE WHEN m.sender_type = 'customer' AND m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN m.id END) as pending_chats
            FROM customers c
            LEFT JOIN tickets t ON c.id = t.customer_id
            LEFT JOIN messages m ON c.phone_number = m.phone_number
            WHERE c.phone_number = ?
            GROUP BY c.id, c.phone_number, c.name, c.created_at
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            return result.data[0];
        }
        
        return null;
    }
}

module.exports = Customer;
