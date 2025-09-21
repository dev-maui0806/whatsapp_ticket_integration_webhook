const { executeQuery } = require('../config/database');
const Message = require('../models/Message');
const Customer = require('../models/Customer');
const Ticket = require('../models/Ticket');
const WhatsAppService = require('./whatsappService');
const whatsappService = new WhatsAppService();

class BotConversationService {
    constructor() {
        this.ticketTypes = [
            { id: 'lock_open', name: 'Unlock', label: 'Unlock' },
            { id: 'lock_repair', name: 'Unlock Repair', label: 'Unlock Repair' },
            { id: 'fund_request', name: 'Funding Request', label: 'Funding Request' },
            { id: 'fuel_request', name: 'Fuel Request', label: 'Fuel Request' },
            { id: 'other', name: 'Other', label: 'Other' }
        ];
    }

    async sendButtons(phoneNumber, header, body, footer, buttons) {
        try {
            const dashText = `${header}\n\n${body}`.trim();
            await this.saveMessage(phoneNumber, dashText, 'system');
            await whatsappService.sendInteractiveMessage(
                phoneNumber,
                header,
                body,
                footer || 'Choose an option below',
                buttons
            );
            return { success: true, message: dashText };
        } catch (e) {
            console.error('sendButtons failed:', e);
            return { success: false, error: e.message };
        }
    }

    // Get conversation state
    async getConversationState(phoneNumber) {
        try {
            const query = `
                SELECT * FROM bot_conversation_states 
                WHERE phone_number = ?
            `;
            
            const result = await executeQuery(query, [phoneNumber]);
            
            if (result.success && result.data.length > 0) {
                const state = result.data[0];
                
                // Handle form_data safely - it could be JSON type or string
                let formData = {};
                if (state.form_data) {
                    try {
                        // If it's already an object (JSON type), use it directly
                        if (typeof state.form_data === 'object') {
                            formData = state.form_data;
                        } else if (typeof state.form_data === 'string') {
                            // If it's a string, try to parse it
                            if (state.form_data === '[object Object]') {
                                // Handle the problematic case where object was stored as string
                                console.warn(`Found problematic form_data '[object Object]' for phone number ${phoneNumber}. Treating as empty object.`);
                                formData = {};
                            } else {
                                formData = JSON.parse(state.form_data);
                            }
                        }
                    } catch (parseError) {
                        console.warn(`Failed to parse form_data for phone number ${phoneNumber}:`, parseError.message);
                        formData = {};
                    }
                }
                
                return {
                    success: true,
                    data: {
                        phoneNumber: state.phone_number,
                        currentStep: state.current_step,
                        ticketType: state.ticket_type,
                        formData: formData,
                        currentTicketId: state.current_ticket_id,
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

    // Update conversation state
    async updateConversationState(phoneNumber, currentStep, ticketType = null, formData = {}, currentTicketId = null, automationChatState = null) {
        try {
            // Ensure formData is always an object before stringifying
            const safeFormData = typeof formData === 'object' && formData !== null ? formData : {};
            
            const query = `
                INSERT INTO bot_conversation_states (
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
                JSON.stringify(safeFormData),
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

    // Clear conversation state
    async clearConversationState(phoneNumber) {
        try {
            const query = `DELETE FROM bot_conversation_states WHERE phone_number = ?`;
            const result = await executeQuery(query, [phoneNumber]);
            return result;
        } catch (error) {
            console.error('Error clearing conversation state:', error);
            return { success: false, error: error.message };
        }
    }

    // Get open tickets for phone number
    async getOpenTickets(phoneNumber) {
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

    // Get form fields for ticket type
    async getFormFields(ticketType) {
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

    // Create ticket from form data
    async createTicketFromFormData(phoneNumber, ticketType, formData) {
        try {
            console.log("Creating ticket from form data:", phoneNumber, ticketType, formData);
            
            // Find or create customer
            const customerResult = await Customer.findOrCreate(phoneNumber, formData.customer_name || 'Customer');
            if (!customerResult.success) {
                return { success: false, error: 'Failed to create customer' };
            }
            
            const customer = customerResult.data;
            console.log("Customer:", customer);
            
            // Create ticket
            const ticketData = {
                customer_id: customer.id,
                issue_type: ticketType,
                vehicle_number: formData.vehicle_number || null,
                driver_number: formData.driver_number || null,
                location: formData.location || null,
                comment: formData.comment || null,
                status: 'open',
                priority: 'medium'
            };
            
            const ticketResult = await Ticket.create(ticketData);
            if (!ticketResult.success) {
                return { success: false, error: 'Failed to create ticket' };
            }
            
            const ticket = ticketResult.data;
            console.log("Ticket created:", ticket);
            
            return {
                success: true,
                ticket: ticket
            };
        } catch (error) {
            console.error('Error creating ticket:', error);
            return { success: false, error: error.message };
        }
    }

    // Save message to database
    async saveMessage(phoneNumber, messageText, senderType = 'customer', ticketId = null, senderId = null) {
        try {
            const messageData = {
                phone_number: phoneNumber,
                ticket_id: ticketId,
                sender_type: senderType,
                sender_id: senderId,
                message_text: messageText,
                message_type: 'text',
                is_from_whatsapp: true
            };
            
            const result = await Message.create(messageData);
            return result;
        } catch (error) {
            console.error('Error saving message:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle initial greeting (when customer first contacts)
    async handleInitialGreeting(phoneNumber, messageText, customerName = null) {
        try {
            // Incoming customer message is already saved by the webhook layer.
            // Avoid saving again here to prevent duplicate rows.
            
            // Check if customer already exists
            const existingCustomer = await Customer.findByPhone(phoneNumber);
            
            if (existingCustomer) {
                // Customer exists, check if they already received the initial greeting
                const recentMessages = await Message.getByPhoneNumber(phoneNumber, 5, 0);
                const hasSystemGreeting = recentMessages.success && recentMessages.data.some(msg => 
                    msg.sender_type === 'system' && 
                    msg.message_text.includes('Type /start to create a new ticket')
                );
                
                if (hasSystemGreeting) {
                    // Customer already received greeting, just return success
                    return { success: true, message: null, customer: existingCustomer };
                }
            }
            
            // Create or find customer
            const customerResult = await Customer.findOrCreate(phoneNumber, customerName || 'Customer');
            if (!customerResult.success) {
                return { success: false, error: 'Failed to create customer' };
            }
            
            // Send initial bot message
            const botMessage = "Type /start to create a new ticket or view a list of existing tickets. To chat with the agency, send a text message.";
            await this.saveMessage(phoneNumber, botMessage, 'system');
            
            return {
                success: true,
                message: botMessage,
                customer: customerResult.data
            };
        } catch (error) {
            console.error('Error handling initial greeting:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle /start command
    async handleStartCommand(phoneNumber) {
        try {
            // '/start' is saved by the webhook before delegating here.
            // Do not save again to avoid duplicates.
            
            // Get open tickets for this phone number
            const openTicketsResult = await this.getOpenTickets(phoneNumber);
            if (!openTicketsResult.success) {
                return { success: false, error: 'Failed to get open tickets' };
            }
            
            const openTickets = openTicketsResult.data || [];
            
            if (openTickets.length > 0) {
                console.log("************openTickets", openTickets)
                const header = 'Opening a Customer Ticket';
                const body = 'Select the ticket you want to open or create a new ticket.';
                const buttons = [{ id: 'start_create', title: 'Create new ticket' }];
                const top = openTickets.slice(0, 2);
                top.forEach(t => buttons.push({ id: `start_open_${t.id}`, title: `${t.ticket_number} (${t.issue_type})` }));
                await this.sendButtons(phoneNumber, header, body, 'Select an option below', buttons);
                await this.updateConversationState(phoneNumber, 'ticket_selection', null, {}, null, 'ticket_selection');
                return { success: true, interactiveSent: true, hasExistingTickets: true };
            } else {
                const header = 'Create Customer Ticket';
                const body = 'Select the ticket to proceed or create a new ticket.';
                await this.sendButtons(phoneNumber, header, body, 'Choose one of the options below', [{ id: 'start_create', title: 'Create New Ticket' }]);
                await this.updateConversationState(phoneNumber, 'new_ticket', null, {}, null, 'new_ticket');
                return { success: true, interactiveSent: true, hasExistingTickets: false };
            }
        } catch (error) {
            console.error('Error handling start command:', error);
            return { success: false, error: error.message };
        }
    }

    // Build ticket selection message
    buildTicketSelectionMessage(openTickets) {
        let message = "Opening a Customer Ticket\nSelect the ticket you want to open or create a new ticket.\n\n";
        
        // Add existing tickets
        openTickets.forEach((ticket, index) => {
            message += `${index + 2}) ${ticket.ticket_number} (${ticket.issue_type})\n`;
        });
        
        message += "1) Create a new ticket\n\n";
        message += "Select an option below.\nPlease reply by entering a number (1-" + (openTickets.length + 1) + ") or the option name.";
        
        return message;
    }

    // Build new ticket message
    buildNewTicketMessage() {
        return "Create Customer Ticket\nSelect the ticket to proceed or create a new ticket.\n1) Create New Ticket\n\nChoose one of the options below. Enter a number (1) or reply with the option name.";
    }

    // Handle ticket selection
    async handleTicketSelection(phoneNumber, messageText, openTickets) {
        try {
            let selection = this.parseSelection(messageText, openTickets.length + 1);
            // Allow special ids coming from interactive button handler to be passed in messageText
            if (!selection && messageText && messageText.startsWith('id:')) {
                const id = messageText.replace('id:', '');
                if (id === 'start_create') selection = 1;
                else if (id.startsWith('start_open_')) {
                    const tid = parseInt(id.replace('start_open_', ''), 10);
                    const idx = openTickets.findIndex(t => t.id === tid);
                    if (idx >= 0) selection = idx + 2;
                }
            }
            
            if (selection === 1) {
                // Create new ticket - use list to show all 5 ticket types
                const header = 'Create New Ticket';
                const body = 'Select the type of ticket you want to create:';
                const footer = 'Choose from the list below:';
                const buttonText = 'Select Ticket Type';
                
                // Build list sections (single section with all ticket types)
                const sections = [
                    {
                        title: 'Ticket Types',
                        rows: this.ticketTypes.map((t, idx) => ({
                            id: `ticket_type_${t.id}`,
                            title: `${idx + 1}) ${t.label}`,
                            description: t.name
                        }))
                    }
                ];
                
                // Save system message for dashboard
                const systemMessage = `${header}\n\n${body}\n${this.ticketTypes.map((t, idx) => `${idx + 1}) ${t.label}`).join('\n')}\n${footer}`;
                await this.saveMessage(phoneNumber, systemMessage, 'system');
                
                // Send interactive list via WhatsApp
                console.log('🚀 Sending interactive list to WhatsApp:', {
                    phoneNumber: whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                    header,
                    body,
                    footer,
                    buttonText,
                    sections
                });
                
                const whatsappResult = await whatsappService.sendListMessage(
                    whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                    header,
                    body,
                    footer,
                    buttonText,
                    sections
                );
                
                console.log('📱 WhatsApp list result:', whatsappResult);
                
                if (!whatsappResult.success) {
                    console.error('Failed to send interactive list via WhatsApp:', whatsappResult.error);
                    return { success: false, error: whatsappResult.error };
                }
                
                await this.updateConversationState(phoneNumber, 'ticket_type_selection', null, {}, null, 'ticket_type_selection');
                
                return {
                    success: true,
                    action: 'create_new_ticket',
                    message: `${header}/n${body}/n${footer}/n${buttonText}/n${sections}`,
                    interactiveSent: true
                };
            } else if (selection > 1 && selection <= openTickets.length + 1) {
                // Select existing ticket
                const selectedTicket = openTickets[selection - 2];
                const message = `A customer technical representative (AGENT) has been assigned to this ticket (${selectedTicket.ticket_number}) and is currently handling it.\n\n1) Would you like to chat with an agent?\n\nPlease reply with "Yes" or "No."`;
                
                await this.saveMessage(phoneNumber, message, 'system');
                await this.updateConversationState(phoneNumber, 'agent_chat_request', null, {}, selectedTicket.id, 'agent_chat_request');
                
                return {
                    success: true,
                    action: 'select_existing_ticket',
                    ticket: selectedTicket,
                    message: message
                };
            } else {
                return {
                    success: false,
                    error: 'Invalid selection. Please reply with a number or option name.'
                };
            }
        } catch (error) {
            console.error('Error handling ticket selection:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle agent chat request
    async handleAgentChatRequest(phoneNumber, messageText, ticketId) {
        try {
            const response = messageText.toLowerCase().trim();
            
            if (response === 'yes' || response === 'y') {
                // Customer wants to chat with agent
                const message = `The customer has requested a chat regarding ticket ${ticketId}.`;
                await this.saveMessage(phoneNumber, message, 'system');
                
                // Update conversation state to open chat
                await this.updateConversationState(phoneNumber, 'OPEN', null, {}, ticketId, null);
                
                return {
                    success: true,
                    action: 'start_agent_chat',
                    message: message
                };
            } else if (response === 'no' || response === 'n') {
                // Customer doesn't want to chat
                const message = "You can restart the bot chat by entering the '/start' command at any time.";
                await this.saveMessage(phoneNumber, message, 'system');
                await this.clearConversationState(phoneNumber);
                
                return {
                    success: true,
                    action: 'decline_agent_chat',
                    message: message
                };
            } else {
                return {
                    success: false,
                    error: 'Please reply with "Yes" or "No."'
                };
            }
        } catch (error) {
            console.error('Error handling agent chat request:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle new ticket selection (when customer selects "Create New Ticket")
    async handleNewTicketSelection(phoneNumber, messageText) {
        try {
            const text = messageText.toLowerCase().trim();
            
           

            // Check if customer selected "Create New Ticket" (option 1)
            if (text === '1' || text.includes('create') || text.includes('new') || text === 'id:start_create') {
                // Show ticket type selection as interactive list

                const textmessage = this.buildTicketTypeSelectionMessage();
                await this.saveMessage(phoneNumber, textmessage, 'system');
                const header = 'Create New Ticket';
                const body = 'Select the type of ticket you want to create:';
                const footer = 'Choose from the list below:';
                const buttonText = 'Select Ticket Type';
                
                // Build list sections (single section with all ticket types)
                const sections = [
                    {
                        title: 'Ticket Types',
                        rows: this.ticketTypes.map((t, idx) => ({
                            id: `ticket_type_${t.id}`,
                            title: `${idx + 1}) ${t.label}`,
                            description: t.name
                        }))
                    }
                ];
                
                // Save system message for dashboard
                const systemMessage = `${header}\n\n${body}\n${this.ticketTypes.map((t, idx) => `${idx + 1}) ${t.label}`).join('\n')}\n${footer}`;
                await this.saveMessage(phoneNumber, systemMessage, 'system');
                
                // Send interactive list via WhatsApp
                console.log('🚀 Sending interactive list to WhatsApp:', {
                    phoneNumber: whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                    header,
                    body,
                    footer,
                    buttonText,
                    sections
                });
                
                const whatsappResult = await whatsappService.sendListMessage(
                    whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                    header,
                    body,
                    footer,
                    buttonText,
                    sections
                );
                
                console.log('📱 WhatsApp list result:', whatsappResult);
                
                if (!whatsappResult.success) {
                    console.error('Failed to send interactive list via WhatsApp:', whatsappResult.error);
                    return { success: false, error: whatsappResult.error };
                }
                
                await this.updateConversationState(phoneNumber, 'ticket_type_selection', null, {}, null, 'ticket_type_selection');
                
                return {
                    success: true,
                    action: 'create_new_ticket',
                    // message: `${header}\n${body}\n${footer}\n${buttonText}\n${sections}`,
                    message: textmessage,
                    interactiveSent: true
                };
            } else {
                return {
                    success: false,
                    error: 'Please reply with "1" or "Create New Ticket" to proceed.'
                };
            }
        } catch (error) {
            console.error('Error handling new ticket selection:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle ticket type selection
    async handleTicketTypeSelection(phoneNumber, messageText) {
        try {
            console.log("***********handleTicketTypeSelection***************", phoneNumber, messageText)

            let selection = this.parseSelection(messageText, this.ticketTypes.length);
            if (!selection && messageText && messageText.startsWith('id:ticket_type_')) {   
                const key = messageText.replace('id:ticket_type_', '');
                const idx = this.ticketTypes.findIndex(t => t.id === key);
                if (idx >= 0) selection = idx + 1;
            }
            
            if (selection >= 1 && selection <= this.ticketTypes.length) {
                const selectedType = this.ticketTypes[selection - 1];
                
                // Map ticket types to template names
                const templateMap = {
                    'lock_open': 'create_ticket_lock_open',
                    'lock_repair': 'create_ticket_lock_repair', 
                    'fund_request': 'create_fund_request_ticket',
                    'fuel_request': 'create_ticket_fuel_request',
                };
                
                const templateName = templateMap[selectedType.id];
                
                if (templateName) {
                    // Send WhatsApp template message
                    console.log('🚀 Sending template message:', templateName);
                    const whatsappResult = await whatsappService.sendTemplateMessage(
                        whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                        templateName
                    );
                    
                    if (!whatsappResult.success) {
                        console.error('Failed to send template message:', whatsappResult.error);
                        // Fallback to plain text message if template fails
                        const fallbackMessage = `Please provide the following information for ${selectedType.label}:\n\nPlease fill out the form and submit your request.`;
                        await this.saveMessage(phoneNumber, fallbackMessage, 'system');
                        
                        return { 
                            success: true, 
                            ticketType: selectedType.id,
                            message: fallbackMessage,
                            interactiveSent: false,
                            fallback: true
                        };
                    }
                    
                    // Save system message for dashboard (plain text format)
                    const systemMessage = `Please provide the following information for ${selectedType.label}:`;
                    await this.saveMessage(phoneNumber, systemMessage, 'system');
                    
                    // Update conversation state to wait for template completion
                    await this.updateConversationState(phoneNumber, 'template_form_filling', selectedType.id, {}, null, 'template_form_filling');
                    
                    return {
                        success: true,
                        ticketType: selectedType.id,
                        templateName: templateName,
                        message: systemMessage,
                        interactiveSent: true
                    };
                } else {
                    // Fallback to old method for 'other' type
                    const message = await this.buildFormFieldsMessage(selectedType.id);
                    await this.saveMessage(phoneNumber, message, 'system');
                    await this.updateConversationState(phoneNumber, 'form_filling', selectedType.id, {}, null, 'form_filling');
                    await this.sendButtons(phoneNumber, 'Enter details', 'Reply with values separated by commas in one message.', 'When ready, press Submit', [
                        { id: 'form_submit', title: 'Submit' },
                        { id: 'form_reenter', title: 'Re-enter details' }
                    ]);
                    
                    return {
                        success: true,
                        ticketType: selectedType.id,
                        message: message,
                        interactiveSent: true
                    };
                }
            } else {
                return {
                    success: false,
                    error: 'Invalid selection. Please reply with a number (1-5) or the option name.'
                };
            }
        } catch (error) {
            console.error('Error handling ticket type selection:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle template form completion (when Complete button is pressed)
    async handleTemplateFormCompletion(phoneNumber, formData, ticketType) {
        try {
            console.log('🎯 Handling template form completion:', {
                phoneNumber,
                formData,
                ticketType
            });
            
            // Create ticket from form data
            const ticketResult = await this.createTicketFromFormData(phoneNumber, ticketType, formData);
            
            if (ticketResult.success) {
                // Send confirmation message
                const confirmationMessage = `Ticket ${ticketResult.ticketNumber} Created.`;
                await this.saveMessage(phoneNumber, confirmationMessage, 'system');
                
                // Send confirmation to WhatsApp
                const whatsappResult = await whatsappService.sendMessage(
                    whatsappService.formatPhoneNumber(phoneNumber) || phoneNumber,
                    confirmationMessage
                );
                
                if (!whatsappResult.success) {
                    console.error('Failed to send confirmation to WhatsApp:', whatsappResult.error);
                }
                
                // Reset conversation state
                await this.updateConversationState(phoneNumber, 'idle', null, {}, null, 'idle');
                
                return {
                    success: true,
                    action: 'ticket_created',
                    ticketNumber: ticketResult.ticketNumber,
                    message: confirmationMessage,
                    whatsappSent: whatsappResult.success
                };
            } else {
                return {
                    success: false,
                    error: ticketResult.error
                };
            }
        } catch (error) {
            console.error('Error handling template form completion:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle comma-separated form filling (original logic)
    async handleFormFilling(phoneNumber, messageText, ticketType, currentFormData = {}) {
        try {
            console.log(`[handleFormFilling] Processing comma-separated input: ${messageText}`);
            
            // Get form fields for the ticket type
            const formFieldsResult = await this.getFormFields(ticketType);
            if (!formFieldsResult.success || !formFieldsResult.data.length) {
                return { success: false, error: 'No form fields found for this ticket type.' };
            }
            
            const formFields = formFieldsResult.data;
            const inputValues = messageText.split(',').map(field => field.trim());
            
            // Validate that we have enough values for required fields
            const requiredFields = formFields.filter(field => field.is_required);
            if (inputValues.length < requiredFields.length) {
                const fieldLabels = requiredFields.map(field => field.field_label).join(', ');
                const message = `❌ Please provide all required fields separated by commas.\n\nRequired: ${fieldLabels}\n\nFormat: value1, value2, value3...`;
                await this.saveMessage(phoneNumber, message, 'system');
                return { success: true, message: 'Insufficient fields provided' };
            }
            
            // Map input values to form fields
            const formData = {};
            let validationErrors = [];
            
            for (let i = 0; i < formFields.length && i < inputValues.length; i++) {
                const field = formFields[i];
                const value = inputValues[i];
                
                if (field.is_required && !value) {
                    validationErrors.push(`${field.field_label} is required`);
                    continue;
                }
                
                // Validate field value
                const validation = this.validateField(field.field_name, value, field.validation_rules);
                if (!validation.isValid) {
                    validationErrors.push(`${field.field_label}: ${validation.error}`);
                    continue;
                }
                
                formData[field.field_name] = value;
            }
            
            // Check for validation errors
            if (validationErrors.length > 0) {
                const message = `❌ Please correct the following errors:\n\n${validationErrors.join('\n')}\n\nPlease provide all fields again in the correct format.`;
                await this.saveMessage(phoneNumber, message, 'system');
                return { success: true, message: 'Validation errors found' };
            }
            
            // All validation passed, create ticket
            const ticketResult = await this.createTicketFromFormData(phoneNumber, ticketType, formData);
            
            if (ticketResult.success) {
                const message = `✅ Ticket ${ticketResult.ticket.ticket_number} has been created successfully!`;
                await this.saveMessage(phoneNumber, message, 'system');
                await this.clearConversationState(phoneNumber);
                
                return {
                    success: true,
                    action: 'ticket_created',
                    ticket: ticketResult.ticket,
                    message: message
                };
            } else {
                const errorMessage = `❌ Failed to create ticket: ${ticketResult.error}\n\nPlease try again.`;
                await this.saveMessage(phoneNumber, errorMessage, 'system');
                return { success: false, error: ticketResult.error };
            }
            
        } catch (error) {
            console.error('Error in handleFormFilling:', error);
            return { success: false, error: error.message };
        }
    }

    // Build form fields message as ticket card
    async buildFormFieldsMessage(ticketType) {
        try {
            const fieldsResult = await this.getFormFields(ticketType);
            if (!fieldsResult.success || !fieldsResult.data.length) {
                return 'No form fields found for this ticket type.';
            }
            
            // Get ticket type display name
            const ticketTypeInfo = this.ticketTypes.find(t => t.id === ticketType);
            const ticketTypeName = ticketTypeInfo ? ticketTypeInfo.name : ticketType;
            
            let message = `📋 **${ticketTypeName} Ticket Form**\n\n`;
            message += `Please provide the following information separated by commas:\n\n`;
            
            const requiredFields = [];
            const optionalFields = [];
            
            fieldsResult.data.forEach((field) => {
                if (field.is_required) {
                    requiredFields.push(field.field_label);
                } else {
                    optionalFields.push(field.field_label);
                }
            });
            
            // Display required fields
            if (requiredFields.length > 0) {
                message += `**Required Fields:**\n`;
                requiredFields.forEach((fieldLabel, index) => {
                    message += `${index + 1}. ${fieldLabel}\n`;
                });
                message += `\n`;
            }
            
            // Display optional fields
            if (optionalFields.length > 0) {
                message += `**Optional Fields:**\n`;
                requiredFields.length > 0 ? 
                    optionalFields.forEach((fieldLabel, index) => {
                        message += `${requiredFields.length + index + 1}. ${fieldLabel}\n`;
                    }) :
                    optionalFields.forEach((fieldLabel, index) => {
                        message += `${index + 1}. ${fieldLabel}\n`;
                    });
                message += `\n`;
            }
            
            message += `**Format:** value1, value2, value3...\n\n`;
            message += `Example: ABC123, John Doe, Warsaw, 2024-01-15, 10:00, Need urgent repair`;
            
            return message;
        } catch (error) {
            console.error('Error building form fields message:', error);
            return 'Error building form fields message.';
        }
    }

    // Build ticket type selection message
    buildTicketTypeSelectionMessage() {
        let message = "Create New Ticket\nSelect the type of ticket you want to create:\n\n";
        
        this.ticketTypes.forEach((type, index) => {
            message += `${index + 1}) ${type.label}\n`;
        });
        
        message += "\nPlease reply with a number (1-5) or the option name.";
        
        return message;
    }

    // Parse selection from message text
    parseSelection(messageText, maxOptions) {
        const text = messageText.toLowerCase().trim();
        
        // Check for numeric selection
        const numericMatch = text.match(/^(\d+)$/);
        if (numericMatch) {
            const selection = parseInt(numericMatch[1]);
            if (selection >= 1 && selection <= maxOptions) {
                return selection;
            }
        }
        
        // Check for text-based selection
        const lowerText = text.toLowerCase();
        
        // For ticket type selection, check for specific ticket types
        if (maxOptions === 5) { // This is ticket type selection
            if (lowerText.includes('unlock') && lowerText.includes('repair')) {
                return 2; // Unlock Repair
            } else if (lowerText.includes('unlock')) {
                return 1; // Unlock
            } else if (lowerText.includes('fund')) {
                return 3; // Funding Request
            } else if (lowerText.includes('fuel')) {
                return 4; // Fuel Request
            } else if (lowerText.includes('other')) {
                return 5; // Other
            }
        }
        
        // For general selection (create new ticket, etc.)
        if (lowerText.includes('create') || lowerText.includes('new')) {
            return 1;
        }
        
        return null;
    }
}

module.exports = BotConversationService;
