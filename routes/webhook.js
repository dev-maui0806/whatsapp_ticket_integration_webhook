const express = require('express');
const axios = require('axios');
const router = express.Router();
const WhatsAppService = require('../services/whatsappService');
const TicketService = require('../services/ticketService');
const EnhancedTicketService = require('../services/enhancedTicketService');
const ConversationStateService = require('../services/conversationStateService');
const { executeQuery } = require('../config/database');

// Initialize services
const whatsappService = new WhatsAppService();
const ticketService = new TicketService();
const enhancedTicketService = new EnhancedTicketService();
const conversationStateService = new ConversationStateService();

// Helper: Send a WhatsApp message programmatically
async function sendWhatsappMessage(phoneNumber, message, app = null) {
    try {
        console.log("___sendwhatsappMessage___", phoneNumber, message)
        const phoneNumberId = '1810065506501128'; // Your business number ID
        const token = process.env.WHATSAPP_ACCESS_TOKEN; // Load from .env
        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            to: phoneNumber, // Must be in international format, no +
            type: 'text',
            text: { body: message }
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, data, { headers });
        console.log('✅ Message sent:', response.data);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ sendWhatsappMessage error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Helper: Send interactive message with buttons
async function sendInteractiveMessage(phoneNumber, header, body, footer, buttons) {
    try {
        const phoneNumberId = '1810065506501128';
        const token = process.env.WHATSAPP_ACCESS_TOKEN;
        const url = `https://graph.facebook.com/v17.0/${phoneNumberId}/messages`;

        const data = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'interactive',
            interactive: {
                type: 'button',
                header: { type: 'text', text: header },
                body: { text: body },
                footer: { text: footer },
                action: {
                    buttons: buttons.map((button, index) => ({
                        type: 'reply',
                        reply: {
                            id: button.id,
                            title: button.title
                        }
                    }))
                }
            }
        };

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const response = await axios.post(url, data, { headers });
        console.log('✅ Interactive message sent:', response.data);
        return { success: true, data: response.data };

    } catch (error) {
        console.error('❌ sendInteractiveMessage error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

// Helper: Get open tickets for a phone number
async function getOpenTickets(phoneNumber) {
    try {
        const query = `
            SELECT t.*, c.phone_number, c.name as customer_name
            FROM tickets t
            JOIN customers c ON t.customer_id = c.id
            WHERE c.phone_number = ? AND t.status IN ('open', 'in_progress', 'pending_customer')
            ORDER BY t.created_at DESC
        `;
        
        const result = await executeQuery(query, [phoneNumber]);
        return result;
    } catch (error) {
        console.error('Error getting open tickets:', error);
        return { success: false, error: error.message };
    }
}

// Helper: Create or update conversation state
async function updateConversationState(phoneNumber, currentStep, ticketType = null, formData = {}, currentTicketId = null, automationChatState = null) {
    try {
        const query = `
            INSERT INTO conversation_states (
                phone_number, current_step, ticket_type, form_data, current_ticket_id, automation_chat_state
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                current_step = VALUES(current_step),
                ticket_type = VALUES(ticket_type),
                form_data = VALUES(form_data),
                current_ticket_id = VALUES(current_ticket_id),
                automation_chat_state = VALUES(automation_chat_state),
                updated_at = CURRENT_TIMESTAMP
        `;
        
        const params = [
            phoneNumber,
            currentStep,
            ticketType,
            JSON.stringify(formData),
            currentTicketId,
            automationChatState
        ];

        const result = await executeQuery(query, params);
        return result;
    } catch (error) {
        console.error('Error updating conversation state:', error);
        return { success: false, error: error.message };
    }
}

// Helper: Get conversation state
async function getConversationState(phoneNumber) {
    try {
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
                    automationChatState: state.automation_chat_state,
                    createdAt: state.created_at,
                    updatedAt: state.updated_at
                }
            };
        }
        
        return { success: true, data: null };
    } catch (error) {
        console.error('Error getting conversation state:', error);
        return { success: false, error: error.message };
    }
}

// Helper: Get form fields for ticket type
async function getFormFields(ticketType) {
    try {
        const query = `
            SELECT * FROM ticket_form_fields 
            WHERE ticket_type = ? 
            ORDER BY display_order ASC
        `;
        
        const result = await executeQuery(query, [ticketType]);
        return result;
    } catch (error) {
        console.error('Error getting form fields:', error);
        return { success: false, error: error.message };
    }
}

// Helper: Create ticket from form data
async function createTicketFromFormData(phoneNumber, ticketType, formData) {
    try {
        // Find or create customer
        const customerQuery = `
            INSERT INTO customers (phone_number, name, created_at, updated_at)
            VALUES (?, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE
                updated_at = NOW()
        `;
        
        await executeQuery(customerQuery, [phoneNumber, formData.customer_name || 'Customer']);
        
        // Get customer ID
        const customerResult = await executeQuery(
            'SELECT id FROM customers WHERE phone_number = ?',
            [phoneNumber]
        );
        
        if (!customerResult.success || customerResult.data.length === 0) {
            return { success: false, error: 'Failed to get customer ID' };
        }
        
        const customerId = customerResult.data[0].id;
        
        // Create ticket
        const ticketQuery = `
            INSERT INTO tickets (
                customer_id, issue_type, vehicle_number, driver_number, location,
                amount, upi_id, quantity, fuel_type, comment, status, priority,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'medium', NOW(), NOW())
        `;
        
        const ticketParams = [
            customerId,
            ticketType,
            formData.vehicle_number || null,
            formData.driver_number || null,
            formData.location || null,
            formData.amount ? parseFloat(formData.amount) : null,
            formData.upi_id || null,
            formData.quantity ? parseInt(formData.quantity) : null,
            formData.fuel_type || null,
            formData.comment || null
        ];
        
        const ticketResult = await executeQuery(ticketQuery, ticketParams);
        
        if (ticketResult.success) {
            const ticketId = ticketResult.data.insertId;
            
            // Generate ticket number
            const ticketNumber = `TCK-${ticketId}`;
            await executeQuery(
                'UPDATE tickets SET ticket_number = ? WHERE id = ?',
                [ticketNumber, ticketId]
            );
            
            return {
                success: true,
                ticket: {
                    id: ticketId,
                    ticket_number: ticketNumber,
                    issue_type: ticketType,
                    status: 'open'
                }
            };
        }
        
        return { success: false, error: 'Failed to create ticket' };
    } catch (error) {
        console.error('Error creating ticket:', error);
        return { success: false, error: error.message };
    }
}

// Helper: Start form filling process
async function startFormFilling(phoneNumber, ticketType) {
    try {
        const fieldsResult = await getFormFields(ticketType);
        if (!fieldsResult.success || !fieldsResult.data.length) {
            await sendWhatsappMessage(phoneNumber, 'No form fields found for this ticket type.');
            return;
        }

        const firstField = fieldsResult.data[0];
        await sendWhatsappMessage(phoneNumber, `Please provide ${firstField.field_label}:`);
        
        await updateConversationState(phoneNumber, 'CLOSE', ticketType, {}, null, 'form_filling');
    } catch (error) {
        console.error('Error starting form filling:', error);
    }
}

// Helper: Handle form filling
async function handleFormFilling(phoneNumber, messageText, currentState) {
    try {
        const fieldsResult = await getFormFields(currentState.ticketType);
        if (!fieldsResult.success) {
            await sendWhatsappMessage(phoneNumber, 'Error getting form fields.');
            return;
        }

        const fields = fieldsResult.data;
        const currentFormData = currentState.formData || {};

        // Find the next field to fill
        let nextField = null;
        for (const field of fields) {
            if (field.is_required && !currentFormData[field.field_name]) {
                nextField = field;
                break;
            }
        }

        if (!nextField) {
            // All fields filled, create ticket
            const ticketResult = await createTicketFromFormData(phoneNumber, currentState.ticketType, currentFormData);
            
            if (ticketResult.success) {
                await sendWhatsappMessage(phoneNumber, `Ticket has been created. Ticket name is ${ticketResult.ticket.ticket_number}`);
                
                // Show open tickets and create new option
                const openTicketsResult = await getOpenTickets(phoneNumber);
                if (openTicketsResult.success && openTicketsResult.data.length > 0) {
                    const buttons = [
                        ...openTicketsResult.data.slice(0, 10).map(t => ({
                            id: `select_ticket_${t.id}`,
                            title: `${t.ticket_number || 'TCK-' + t.id}`
                        })),
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Open Tickets',
                        'Select a ticket to continue or create a new one.',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'ticket_selection');
                } else {
                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, null);
                }
            } else {
                await sendWhatsappMessage(phoneNumber, 'Failed to create ticket. Please try again.');
            }
            return;
        }

        // Validate and save field value
        const validation = validateField(nextField, messageText);
        if (!validation.isValid) {
            await sendWhatsappMessage(phoneNumber, `❌ ${validation.error}\n\nPlease provide ${nextField.field_label}:`);
            return;
        }

        // Save field value
        currentFormData[nextField.field_name] = messageText;
        await updateConversationState(phoneNumber, 'CLOSE', currentState.ticketType, currentFormData, null, 'form_filling');

        // Find next field
        let nextNextField = null;
        for (const field of fields) {
            if (field.is_required && !currentFormData[field.field_name]) {
                nextNextField = field;
                break;
            }
        }

        if (nextNextField) {
            await sendWhatsappMessage(phoneNumber, `✅ ${nextField.field_label} saved!\n\nPlease provide ${nextNextField.field_label}:`);
        } else {
            // All fields filled, create ticket
            const ticketResult = await createTicketFromFormData(phoneNumber, currentState.ticketType, currentFormData);
            
            if (ticketResult.success) {
                await sendWhatsappMessage(phoneNumber, `Ticket has been created. Ticket name is ${ticketResult.ticket.ticket_number}`);
                
                // Show open tickets and create new option
                const openTicketsResult = await getOpenTickets(phoneNumber);
                if (openTicketsResult.success && openTicketsResult.data.length > 0) {
                    const buttons = [
                        ...openTicketsResult.data.slice(0, 10).map(t => ({
                            id: `select_ticket_${t.id}`,
                            title: `${t.ticket_number || 'TCK-' + t.id}`
                        })),
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Open Tickets',
                        'Select a ticket to continue or create a new one.',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'ticket_selection');
                } else {
                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, null);
                }
            } else {
                await sendWhatsappMessage(phoneNumber, 'Failed to create ticket. Please try again.');
            }
        }
    } catch (error) {
        console.error('Error handling form filling:', error);
        await sendWhatsappMessage(phoneNumber, 'An error occurred. Please try again.');
    }
}

// Helper: Validate field value
function validateField(field, value) {
    if (field.is_required && (!value || value.trim() === '')) {
        return { isValid: false, error: `${field.field_label} is required` };
    }

    if (field.validation_rules) {
        const rules = JSON.parse(field.validation_rules);
        
        if (rules.max_length && value.length > rules.max_length) {
            return { isValid: false, error: `${field.field_label} must be less than ${rules.max_length} characters` };
        }

        if (rules.min !== undefined && Number(value) < rules.min) {
            return { isValid: false, error: `${field.field_label} must be at least ${rules.min}` };
        }

        if (rules.max !== undefined && Number(value) > rules.max) {
            return { isValid: false, error: `${field.field_label} must be at most ${rules.max}` };
        }

        if (rules.options && !rules.options.includes(value)) {
            return { isValid: false, error: `${field.field_label} must be one of: ${rules.options.join(', ')}` };
        }
    }

    return { isValid: true };
}


// Expose helper on router for reuse from other modules
router.sendWhatsappMessage = sendWhatsappMessage;

// Webhook verification endpoint
router.get('/', (req, res) => {
    console.log("webhook_get", req.query)
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log('Webhook verification request:', { mode, token, challenge });

    const verificationResult = whatsappService.verifyWebhook(mode, token, challenge);

    if (verificationResult) {
        console.log('✅ Webhook verified successfully');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Webhook verification failed');
        res.status(403).json({ error: 'Verification failed' });
    }
});

// Webhook endpoint for receiving messages
router.post('/', async (req, res) => {
    try {
        // Log webhook data to database
        const logQuery = 'INSERT INTO webhook_logs (webhook_data) VALUES (?)';
        await executeQuery(logQuery, [JSON.stringify(req.body)]);
        console.log("webhook_post", req.body);
        // Process webhook data
        const messages = whatsappService.processWebhook(req.body);
        console.log("messages", messages);
        if (messages.length === 0) {
            console.log('No messages to process');
            return res.status(200).json({ status: 'success', message: 'No messages to process' });
        }

        // Process each message
        const results = [];
        for (const message of messages) {
            console.log(`Processing message from ${message.from}: ${message.text}`);

            const phoneNumber = whatsappService.formatPhoneNumber(message.from);
            const messageText = message.text || '';

            // Get current conversation state
            const stateResult = await getConversationState(phoneNumber);
            if (!stateResult.success) {
                console.error('Failed to get conversation state:', stateResult.error);
                continue;
            }

            const currentState = stateResult.data;

            // Handle /close command
            if (messageText.toLowerCase().trim() === '/close') {
                if (currentState && currentState.currentTicketId) {
                    // Clear current ticket binding
                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, null);
                    await sendWhatsappMessage(phoneNumber, 'Conversation ended. You can start a new conversation anytime.');
                } else {
                    await sendWhatsappMessage(phoneNumber, 'No active conversation to close.');
                }
                continue;
            }

            // Check if customer has existing tickets
            const openTicketsResult = await getOpenTickets(phoneNumber);
            if (!openTicketsResult.success) {
                console.error('Failed to get open tickets:', openTicketsResult.error);
                continue;
            }

            const hasOpenTickets = openTicketsResult.data && openTicketsResult.data.length > 0;

            // If no conversation state exists, this is a first message
            if (!currentState) {
                if (hasOpenTickets) {
                    // Show existing tickets and create new option
                    const buttons = [
                        ...openTicketsResult.data.slice(0, 10).map(t => ({
                            id: `select_ticket_${t.id}`,
                            title: `${t.ticket_number || 'TCK-' + t.id}`
                        })),
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Welcome Back!',
                        'You have existing tickets. Select one to continue or create a new ticket.',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'ticket_selection');
                } else {
                    // New customer - ask if they want to create a new ticket
                    const buttons = [
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Welcome!',
                        'Do you want to create a new ticket?',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'new_ticket_question');
                }
                continue;
            }

            // Handle existing conversation state
            if (currentState.currentStep === 'OPEN' && currentState.currentTicketId) {
                // Customer is chatting with an agent on a specific ticket
                // Save message to ticket
                const messageQuery = `
                    INSERT INTO messages (ticket_id, sender_type, sender_id, message_text, message_type, is_from_whatsapp, created_at)
                    VALUES (?, 'customer', NULL, ?, 'text', 1, NOW())
                `;
                
                await executeQuery(messageQuery, [currentState.currentTicketId, messageText]);
                
                // Notify agents (if socket service is available)
            try {
                const socketService = req.app.get('socketService');
                    if (socketService) {
                        const ticket = await executeQuery(
                            'SELECT * FROM tickets WHERE id = ?',
                            [currentState.currentTicketId]
                        );
                        
                        if (ticket.success && ticket.data.length > 0) {
                    socketService.broadcastToAgents('newCustomerMessage', {
                                ticket: ticket.data[0],
                                message: {
                                    message_text: messageText,
                            created_at: new Date().toISOString(),
                            sender_type: 'customer'
                        },
                                customer: { phone_number: phoneNumber }
                            });
                    }
                }
            } catch (e) {
                console.error('Socket broadcast error:', e);
            }
                
                continue;
            }

            // Handle ticket selection or creation
            if (currentState.automationChatState === 'ticket_selection') {
                if (messageText.toLowerCase().includes('create') || messageText.toLowerCase().includes('new')) {
                    // Show ticket type selection
                    const buttons = [
                        { id: 'type_lock_open', title: 'Unlock' },
                        { id: 'type_lock_repair', title: 'Unlock Repair' },
                        { id: 'type_fund_request', title: 'Funding Request' },
                        { id: 'type_fuel_request', title: 'Fuel Request' },
                        { id: 'type_other', title: 'Other' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Create New Ticket',
                        'Select the type of ticket you want to create:',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'ticket_type_selection');
                } else {
                    // Try to parse ticket selection
                    const numeric = messageText.replace(/[^0-9]/g, '');
                    const selectedTicket = openTicketsResult.data.find(t => 
                        t.ticket_number === messageText || 
                        t.ticket_number === `TCK-${numeric}` ||
                        t.id.toString() === numeric
                    );

                    if (selectedTicket) {
                        // Bind to selected ticket
                        await updateConversationState(phoneNumber, 'OPEN', null, {}, selectedTicket.id, null);
                        await sendWhatsappMessage(phoneNumber, `You are now chatting on ticket ${selectedTicket.ticket_number}. Send your message.`);
                    } else {
                        await sendWhatsappMessage(phoneNumber, 'Invalid selection. Please try again.');
                    }
                }
                continue;
            }

            // Handle ticket type selection
            if (currentState.automationChatState === 'ticket_type_selection') {
                let ticketType = null;
                if (messageText.toLowerCase().includes('unlock') && !messageText.toLowerCase().includes('repair')) {
                    ticketType = 'lock_open';
                } else if (messageText.toLowerCase().includes('repair')) {
                    ticketType = 'lock_repair';
                } else if (messageText.toLowerCase().includes('fund')) {
                    ticketType = 'fund_request';
                } else if (messageText.toLowerCase().includes('fuel')) {
                    ticketType = 'fuel_request';
                } else if (messageText.toLowerCase().includes('other')) {
                    ticketType = 'other';
                }

                if (ticketType) {
                    if (ticketType === 'fuel_request') {
                        // Show fuel type selection
                        const buttons = [
                            { id: 'fuel_amount', title: 'Amount' },
                            { id: 'fuel_quantity', title: 'Quantity' }
                        ];

                        await sendInteractiveMessage(
                            phoneNumber,
                            'Fuel Request Type',
                            'What type of fuel request do you want to make?',
                            'Choose an option below',
                            buttons
                        );

                        await updateConversationState(phoneNumber, 'CLOSE', ticketType, {}, null, 'fuel_type_selection');
                    } else {
                        // Start form filling
                        await updateConversationState(phoneNumber, 'CLOSE', ticketType, {}, null, 'form_filling');
                        await startFormFilling(phoneNumber, ticketType);
                    }
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Invalid selection. Please try again.');
                }
                continue;
            }

            // Handle fuel type selection
            if (currentState.automationChatState === 'fuel_type_selection') {
                let fuelType = null;
                if (messageText.toLowerCase().includes('amount')) {
                    fuelType = 'amount';
                } else if (messageText.toLowerCase().includes('quantity')) {
                    fuelType = 'quantity';
                }

                if (fuelType) {
                    const formData = { fuel_type: fuelType };
                    await updateConversationState(phoneNumber, 'CLOSE', currentState.ticketType, formData, null, 'form_filling');
                    await startFormFilling(phoneNumber, currentState.ticketType);
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Invalid selection. Please try again.');
                }
                continue;
            }

            // Handle form filling
            if (currentState.automationChatState === 'form_filling') {
                await handleFormFilling(phoneNumber, messageText, currentState);
                continue;
            }

            // Handle new ticket question
            if (currentState.automationChatState === 'new_ticket_question') {
                if (messageText.toLowerCase().includes('yes') || messageText.toLowerCase().includes('create')) {
                    // Show ticket type selection
                    const buttons = [
                        { id: 'type_lock_open', title: 'Unlock' },
                        { id: 'type_lock_repair', title: 'Unlock Repair' },
                        { id: 'type_fund_request', title: 'Funding Request' },
                        { id: 'type_fuel_request', title: 'Fuel Request' },
                        { id: 'type_other', title: 'Other' }
                    ];

                    await sendInteractiveMessage(
                        phoneNumber,
                        'Create New Ticket',
                        'Select the type of ticket you want to create:',
                        'Choose an option below',
                        buttons
                    );

                    await updateConversationState(phoneNumber, 'CLOSE', null, {}, null, 'ticket_type_selection');
                } else {
                    await sendWhatsappMessage(phoneNumber, 'Please reply with "yes" to create a new ticket or "no" to cancel.');
                }
                continue;
            }

            // Default response
            await sendWhatsappMessage(phoneNumber, 'I didn\'t understand that. Please try again.');

            results.push({
                messageId: message.id,
                from: message.from,
                success: true,
                error: null
            });
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
        const logQuery = 'INSERT INTO webhook_logs (webhook_data, processed, error_message) VALUES (?, ?, ?)';
        await executeQuery(logQuery, [JSON.stringify(req.body), false, error.message]);

        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Test endpoint to send a message
router.post('/test-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        if (!phoneNumber || !message) {
            return res.status(400).json({
                error: 'Phone number and message are required'
            });
        }
        console.log(phoneNumber, message);

        const result = await whatsappService.sendMessage(phoneNumber, message);

        console.log(result);

        res.status(200).json({
            success: result.success,
            data: result.data,
            error: result.error
        });
    } catch (error) {
        console.error('Test message error:', error);
        res.status(500).json({ error: error.message });
    }
});


// Endpoint to get webhook logs
router.get('/webhook-logs', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const offset = (page - 1) * limit;

        const query = `
            SELECT id, webhook_data, processed, error_message, created_at
            FROM webhook_logs
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?
        `;

        const result = await executeQuery(query, [limit, offset]);

        if (result.success) {
            res.status(200).json({
                success: true,
                data: result.data,
                page: page,
                limit: limit
            });
        } else {
            res.status(500).json({ error: result.error });
        }
    } catch (error) {
        console.error('Error fetching webhook logs:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'WhatsApp Webhook Service'
    });
});

module.exports = router;
