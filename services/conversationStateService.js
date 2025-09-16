const { executeQuery } = require('../config/database');

class ConversationStateService {
    constructor() {
        this.steps = {
            INITIAL: 'initial',
            TICKET_TYPE_SELECTION: 'ticket_type_selection',
            FUEL_TYPE_SELECTION: 'fuel_type_selection',
            FORM_FILLING: 'form_filling',
            COMPLETED: 'completed'
        };

        this.ticketTypes = {
            LOCK_OPEN: 'lock_open',
            LOCK_REPAIR: 'lock_repair',
            FUND_REQUEST: 'fund_request',
            FUEL_REQUEST: 'fuel_request',
            OTHER: 'other'
        };
    }

    // Get conversation state for a phone number
    async getState(phoneNumber) {
        const query = `
            SELECT cs.*, t.ticket_number, t.status as ticket_status
            FROM conversation_states cs
            LEFT JOIN tickets t ON cs.current_ticket_id = t.id
            WHERE cs.phone_number = ?
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        
        if (result.success && result.data.length > 0) {
            const state = result.data[0];
            return {
                success: true,
                data: {
                    phoneNumber: state.phone_number,
                    currentStep: state.current_step,
                    ticketType: state.ticket_type,
                    formData: state.form_data ? JSON.parse(state.form_data) : {},
                    currentTicketId: state.current_ticket_id,
                    ticketNumber: state.ticket_number,
                    ticketStatus: state.ticket_status,
                    createdAt: state.created_at,
                    updatedAt: state.updated_at
                }
            };
        }
        
        return { success: true, data: null };
    }

    // Create or update conversation state
    async setState(phoneNumber, stateData) {
        const { currentStep, ticketType, formData, currentTicketId } = stateData;
        
        const query = `
            INSERT INTO conversation_states (
                phone_number, current_step, ticket_type, form_data, current_ticket_id
            ) VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                current_step = VALUES(current_step),
                ticket_type = VALUES(ticket_type),
                form_data = VALUES(form_data),
                current_ticket_id = VALUES(current_ticket_id),
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const params = [
            phoneNumber,
            currentStep,
            ticketType || null,
            formData ? JSON.stringify(formData) : null,
            currentTicketId || null
        ];

        const result = await executeQuery(query, params);
        return result;
    }

    // Update form data for current conversation
    async updateFormData(phoneNumber, fieldName, fieldValue) {
        const stateResult = await this.getState(phoneNumber);
        
        if (!stateResult.success || !stateResult.data) {
            return { success: false, error: 'No active conversation found' };
        }

        const currentFormData = stateResult.data.formData || {};
        currentFormData[fieldName] = fieldValue;

        return await this.setState(phoneNumber, {
            currentStep: stateResult.data.currentStep,
            ticketType: stateResult.data.ticketType,
            formData: currentFormData,
            currentTicketId: stateResult.data.currentTicketId
        });
    }

    // Clear conversation state
    async clearState(phoneNumber) {
        const query = 'DELETE FROM conversation_states WHERE phone_number = ?';
        const result = await executeQuery(query, [phoneNumber]);
        return result;
    }

    // Get next form field for current ticket type
    async getNextFormField(phoneNumber) {
        const stateResult = await this.getState(phoneNumber);
        
        if (!stateResult.success || !stateResult.data || !stateResult.data.ticketType) {
            return { success: false, error: 'No active form found' };
        }

        const ticketType = stateResult.data.ticketType;
        const currentFormData = stateResult.data.formData || {};

        // Get all required fields for this ticket type
        const fieldsQuery = `
            SELECT * FROM ticket_form_fields 
            WHERE ticket_type = ? 
            ORDER BY display_order ASC
        `;
        
        const fieldsResult = await executeQuery(fieldsQuery, [ticketType]);
        
        if (!fieldsResult.success) {
            return { success: false, error: 'Failed to get form fields' };
        }

        // Find the first missing required field
        for (const field of fieldsResult.data) {
            if (field.is_required && !currentFormData[field.field_name]) {
                return {
                    success: true,
                    data: {
                        fieldName: field.field_name,
                        fieldLabel: field.field_label,
                        fieldType: field.field_type,
                        validationRules: field.validation_rules ? JSON.parse(field.validation_rules) : null,
                        isRequired: field.is_required
                    }
                };
            }
        }

        // All required fields are filled
        return { success: true, data: null };
    }

    // Check if form is complete
    async isFormComplete(phoneNumber) {
        const nextFieldResult = await this.getNextFormField(phoneNumber);
        return nextFieldResult.success && nextFieldResult.data === null;
    }

    // Get form completion status
    async getFormStatus(phoneNumber) {
        const stateResult = await this.getState(phoneNumber);
        
        if (!stateResult.success || !stateResult.data || !stateResult.data.ticketType) {
            return { success: false, error: 'No active form found' };
        }

        const ticketType = stateResult.data.ticketType;
        const currentFormData = stateResult.data.formData || {};

        // Get all fields for this ticket type
        const fieldsQuery = `
            SELECT * FROM ticket_form_fields 
            WHERE ticket_type = ? 
            ORDER BY display_order ASC
        `;
        
        const fieldsResult = await executeQuery(fieldsQuery, [ticketType]);
        
        if (!fieldsResult.success) {
            return { success: false, error: 'Failed to get form fields' };
        }

        const totalFields = fieldsResult.data.length;
        const filledFields = fieldsResult.data.filter(field => 
            currentFormData[field.field_name] !== undefined && 
            currentFormData[field.field_name] !== null && 
            currentFormData[field.field_name] !== ''
        ).length;

        return {
            success: true,
            data: {
                totalFields,
                filledFields,
                completionPercentage: Math.round((filledFields / totalFields) * 100),
                isComplete: filledFields === totalFields
            }
        };
    }

    // Validate field value
    validateField(fieldName, fieldValue, validationRules) {
        if (!validationRules) return { isValid: true };

        // Check required
        if (validationRules.required && (!fieldValue || fieldValue.toString().trim() === '')) {
            return { isValid: false, error: `${fieldName} is required` };
        }

        // Check max length
        if (validationRules.max_length && fieldValue.toString().length > validationRules.max_length) {
            return { isValid: false, error: `${fieldName} must be less than ${validationRules.max_length} characters` };
        }

        // Check min/max for numbers
        if (validationRules.min !== undefined && Number(fieldValue) < validationRules.min) {
            return { isValid: false, error: `${fieldName} must be at least ${validationRules.min}` };
        }

        if (validationRules.max !== undefined && Number(fieldValue) > validationRules.max) {
            return { isValid: false, error: `${fieldName} must be at most ${validationRules.max}` };
        }

        // Check options for select fields
        if (validationRules.options && !validationRules.options.includes(fieldValue)) {
            return { isValid: false, error: `${fieldName} must be one of: ${validationRules.options.join(', ')}` };
        }

        return { isValid: true };
    }

    // Get all open tickets for a phone number
    async getOpenTickets(phoneNumber) {
        const query = `
            SELECT t.*, c.phone_number, c.name as customer_name
            FROM tickets t
            JOIN customers c ON t.customer_id = c.id
            WHERE c.phone_number = ? AND t.status IN ('open', 'in_progress', 'pending_customer')
            ORDER BY t.created_at DESC
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        return result;
    }

    // Set selected ticket ID for a conversation
    async setSelectedTicket(phoneNumber, ticketId) {
        const stateResult = await this.getState(phoneNumber);
        
        if (!stateResult.success) {
            return { success: false, error: 'Failed to get conversation state' };
        }

        const currentState = stateResult.data || {};
        
        return await this.setState(phoneNumber, {
            currentStep: currentState.currentStep || 'completed',
            ticketType: currentState.ticketType,
            formData: currentState.formData || {},
            currentTicketId: ticketId
        });
    }
}

module.exports = ConversationStateService;
