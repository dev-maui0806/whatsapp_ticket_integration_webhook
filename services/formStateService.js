const { executeQuery } = require('../config/database');

class FormStateService {
    constructor() {
        // Define form field requirements for each ticket type
        this.FORM_FIELDS = {
            lock_open: ['vehicle_number', 'driver_number', 'location', 'comment'],
            lock_repair: ['vehicle_number', 'driver_number', 'location', 'availability_date', 'availability_time', 'comment'],
            fund_request: ['vehicle_number', 'driver_number', 'amount', 'comment', 'upi_id'],
            fuel_request: ['vehicle_number', 'driver_number', 'comment'], // amount/quantity and upi_id are conditional
            other: ['comment']
        };
    }

    // Get or create user form state
    async getUserFormState(customerId) {
        try {
            const query = 'SELECT * FROM user_form_states WHERE customer_id = ?';
            const result = await executeQuery(query, [customerId]);
            
            if (result.success && result.data.length > 0) {
                const state = result.data[0];
                state.form_data = state.form_data ? JSON.parse(state.form_data) : {};
                return state;
            }
            
            // Create new state
            return await this.createUserFormState(customerId);
        } catch (error) {
            console.error('Error getting user form state:', error);
            throw error;
        }
    }

    // Create new user form state
    async createUserFormState(customerId) {
        try {
            const query = `
                INSERT INTO user_form_states (customer_id, current_step, form_data) 
                VALUES (?, 'initial', '{}')
                ON DUPLICATE KEY UPDATE 
                current_step = 'initial', 
                form_data = '{}', 
                selected_category = NULL,
                fuel_request_type = NULL,
                updated_at = CURRENT_TIMESTAMP
            `;
            
            const result = await executeQuery(query, [customerId]);
            
            if (result.success) {
                return {
                    id: result.data.insertId,
                    customer_id: customerId,
                    current_step: 'initial',
                    selected_category: null,
                    fuel_request_type: null,
                    form_data: {}
                };
            }
            
            throw new Error('Failed to create user form state');
        } catch (error) {
            console.error('Error creating user form state:', error);
            throw error;
        }
    }

    // Update user form state
    async updateUserFormState(customerId, updates) {
        try {
            const current = await this.getUserFormState(customerId);
            
            // Merge form data
            const updatedFormData = { ...current.form_data, ...updates.form_data };
            
            const query = `
                UPDATE user_form_states 
                SET current_step = ?, 
                    selected_category = ?, 
                    fuel_request_type = ?,
                    form_data = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE customer_id = ?
            `;
            
            const params = [
                updates.current_step || current.current_step,
                updates.selected_category || current.selected_category,
                updates.fuel_request_type || current.fuel_request_type,
                JSON.stringify(updatedFormData),
                customerId
            ];
            
            const result = await executeQuery(query, params);
            
            if (result.success) {
                return {
                    ...current,
                    ...updates,
                    form_data: updatedFormData
                };
            }
            
            throw new Error('Failed to update user form state');
        } catch (error) {
            console.error('Error updating user form state:', error);
            throw error;
        }
    }

    // Clear user form state (when ticket is created)
    async clearUserFormState(customerId) {
        try {
            const query = 'DELETE FROM user_form_states WHERE customer_id = ?';
            const result = await executeQuery(query, [customerId]);
            return result.success;
        } catch (error) {
            console.error('Error clearing user form state:', error);
            throw error;
        }
    }

    // Get next required field for current category
    getNextRequiredField(category, currentFormData, fuelRequestType = null) {
        const fields = this.FORM_FIELDS[category] || [];
        
        // Special handling for fuel_request
        if (category === 'fuel_request') {
            const baseFields = ['vehicle_number', 'driver_number'];
            const amountFields = ['amount', 'upi_id', 'comment'];
            const quantityFields = ['quantity', 'comment'];
            
            if (fuelRequestType === 'amount') {
                fields.push(...baseFields, ...amountFields);
            } else if (fuelRequestType === 'quantity') {
                fields.push(...baseFields, ...quantityFields);
            } else {
                // Need to ask for fuel request type first
                return 'fuel_request_type';
            }
        }
        
        // Find first missing field
        for (const field of fields) {
            if (!currentFormData[field] || currentFormData[field] === '') {
                return field;
            }
        }
        
        return null; // All fields collected
    }

    // Check if form is complete
    isFormComplete(category, formData, fuelRequestType = null) {
        return this.getNextRequiredField(category, formData, fuelRequestType) === null;
    }

    // Get field prompt message
    getFieldPrompt(field, category) {
        const prompts = {
            vehicle_number: 'Please enter your Vehicle Number:',
            driver_number: 'Please enter your Driver Number:',
            location: 'Please enter your Location:',
            amount: 'Please enter the Amount (max 5 digits):',
            quantity: 'Please enter the Quantity (max 4 digits):',
            upi_id: 'Please enter your UPI ID:',
            availability_date: 'Please enter your Available Date (DD/MM/YYYY):',
            availability_time: 'Please enter your Available Time (HH:MM):',
            comment: 'Please enter any additional comments:',
            fuel_request_type: 'How would you like to request fuel?\n\n1. By Amount\n2. By Quantity\n\nReply with 1 or 2:'
        };
        
        return prompts[field] || 'Please provide the required information:';
    }

    // Validate field input
    validateFieldInput(field, value) {
        switch (field) {
            case 'amount':
                const amount = parseFloat(value);
                if (isNaN(amount) || amount <= 0 || amount > 99999) {
                    return { valid: false, error: 'Please enter a valid amount (1-99999)' };
                }
                return { valid: true, value: amount };
                
            case 'quantity':
                const qty = parseInt(value);
                if (isNaN(qty) || qty <= 0 || qty > 9999) {
                    return { valid: false, error: 'Please enter a valid quantity (1-9999)' };
                }
                return { valid: true, value: qty };
                
            case 'fuel_request_type':
                if (value === '1' || value.toLowerCase().includes('amount')) {
                    return { valid: true, value: 'amount' };
                } else if (value === '2' || value.toLowerCase().includes('quantity')) {
                    return { valid: true, value: 'quantity' };
                }
                return { valid: false, error: 'Please reply with 1 for Amount or 2 for Quantity' };
                
            case 'availability_date':
                // Basic date validation (DD/MM/YYYY format)
                const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
                if (!dateRegex.test(value)) {
                    return { valid: false, error: 'Please enter date in DD/MM/YYYY format' };
                }
                return { valid: true, value: value };
                
            case 'availability_time':
                // Basic time validation (HH:MM format)
                const timeRegex = /^(\d{1,2}):(\d{2})$/;
                if (!timeRegex.test(value)) {
                    return { valid: false, error: 'Please enter time in HH:MM format' };
                }
                return { valid: true, value: value };
                
            default:
                // Basic validation for other fields
                if (!value || value.trim() === '') {
                    return { valid: false, error: 'This field cannot be empty' };
                }
                return { valid: true, value: value.trim() };
        }
    }
}

module.exports = FormStateService; 