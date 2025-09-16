const Ticket = require('../models/Ticket');
const Customer = require('../models/Customer');
const Message = require('../models/Message');
const WhatsAppService = require('./whatsappService');
const ConversationStateService = require('./conversationStateService');

class EnhancedTicketService {
    constructor() {
        this.whatsappService = new WhatsAppService();
        this.conversationStateService = new ConversationStateService();
    }

    // Helper function: Check open tickets for a phone number
    async checkOpenTickets(phoneNumber) {
        try {
            console.log(`[checkOpenTickets] Checking open tickets for: ${phoneNumber}`);
            
            const result = await this.conversationStateService.getOpenTickets(phoneNumber);
            
            if (result.success && result.data.length > 0) {
                console.log(`[checkOpenTickets] Found ${result.data.length} open tickets`);
                return {
                    success: true,
                    hasOpenTickets: true,
                    tickets: result.data
                };
            }
            
            console.log(`[checkOpenTickets] No open tickets found`);
            return {
                success: true,
                hasOpenTickets: false,
                tickets: []
            };
        } catch (error) {
            console.error('[checkOpenTickets] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper function: Create new ticket
    async createTicket(ticketData) {
        try {
            console.log(`[createTicket] Creating ticket with data:`, ticketData);
            
            // Find or create customer
            const customerResult = await Customer.findOrCreate(
                ticketData.phone_number, 
                ticketData.customer_name
            );
            
            if (!customerResult.success) {
                return { success: false, error: 'Failed to create customer' };
            }

            // Prepare ticket data
            const ticketCreateData = {
                customer_id: customerResult.data.id,
                assigned_agent_id: ticketData.assigned_agent_id || null,
                status: ticketData.status || 'open',
                priority: ticketData.priority || 'medium',
                issue_type: ticketData.issue_type,
                vehicle_number: ticketData.vehicle_number || null,
                driver_number: ticketData.driver_number || null,
                location: ticketData.location || null,
                availability_date: ticketData.availability_date || null,
                availability_time: ticketData.availability_time || null,
                amount: ticketData.amount || null,
                upi_id: ticketData.upi_id || null,
                quantity: ticketData.quantity || null,
                fuel_type: ticketData.fuel_type || null,
                comment: ticketData.comment || null
            };

            // Create ticket
            const ticketResult = await Ticket.create(ticketCreateData);
            
            if (ticketResult.success) {
                console.log(`[createTicket] Ticket created successfully: ${ticketResult.data.ticket_number}`);
                
                // Add initial message if provided
                if (ticketData.initial_message) {
                    await ticketResult.data.addMessage({
                        sender_type: 'customer',
                        sender_id: null,
                        message_text: ticketData.initial_message,
                        message_type: 'text',
                        is_from_whatsapp: true
                    });
                }
                
                return {
                    success: true,
                    ticket: ticketResult.data
                };
            }
            
            return { success: false, error: ticketResult.error };
        } catch (error) {
            console.error('[createTicket] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Helper function: Save message to ticket
    async saveMessage(ticketId, from, message, messageType = 'text', whatsappMessageId = null) {
        try {
            console.log(`[saveMessage] Saving message to ticket ${ticketId}: ${message}`);
            
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const messageData = {
                sender_type: from === 'customer' ? 'customer' : 'agent',
                sender_id: from === 'customer' ? null : from,
                message_text: message,
                message_type: messageType,
                is_from_whatsapp: from === 'customer',
                whatsapp_message_id: whatsappMessageId
            };

            const result = await ticket.addMessage(messageData);
            
            if (result.success) {
                console.log(`[saveMessage] Message saved successfully`);
                return { success: true, message: result.data };
            }
            
            return { success: false, error: result.error };
        } catch (error) {
            console.error('[saveMessage] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Main function: Process incoming WhatsApp message
    async processIncomingMessage(whatsappMessage) {
        try {
            const phoneNumber = this.whatsappService.formatPhoneNumber(whatsappMessage.from);
            const messageText = whatsappMessage.text || '';
            
            console.log(`[processIncomingMessage] Processing message from ${phoneNumber}: ${messageText}`);

            // Check current conversation state; if bound to a ticket, append to that ticket by ID
            const stateResult = await this.conversationStateService.getState(phoneNumber);
            if (stateResult.success && stateResult.data && stateResult.data.currentTicketId) {
                const boundTicketId = stateResult.data.currentTicketId;
                const messageResult = await this.saveMessage(
                    boundTicketId,
                    'customer',
                    messageText,
                    whatsappMessage.type || 'text',
                    whatsappMessage.id
                );
                if (!messageResult.success) {
                    return { success: false, error: messageResult.error };
                }
                const ticketModel = await Ticket.findById(boundTicketId);
                return {
                    success: true,
                    ticket: ticketModel,
                    message: messageResult.message,
                    context: 'bound_ticket_message'
                };
            }

            // Otherwise check if user has open tickets to list/select
            const openTicketsResult = await this.checkOpenTickets(phoneNumber);
            
            if (!openTicketsResult.success) {
                return { success: false, error: openTicketsResult.error };
            }

            // If user has open tickets, show them and ask if they want to create new one
            if (openTicketsResult.hasOpenTickets) {
                return await this.handleUserWithOpenTickets(phoneNumber, messageText, openTicketsResult.tickets, whatsappMessage);
            }

            // No open tickets, start new ticket creation flow
            return await this.handleNewTicketFlow(phoneNumber, messageText, whatsappMessage);

        } catch (error) {
            console.error('[processIncomingMessage] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle user who has open tickets
    async handleUserWithOpenTickets(phoneNumber, messageText, openTickets, whatsappMessage) {
        try {
            console.log(`[handleUserWithOpenTickets] User has ${openTickets.length} open tickets`);
            
            // Check if this is a response to the open tickets listing
            const stateResult = await this.conversationStateService.getState(phoneNumber);
            if (stateResult.success && stateResult.data && stateResult.data.currentStep === 'awaiting_ticket_selection') {
                const input = (messageText || '').trim().toLowerCase();
                if (input === 'new' || input === 'create') {
                    await this.conversationStateService.clearState(phoneNumber);
                    return await this.showTicketTypeMenu(phoneNumber);
                }
                // Parse ticket number like TCK-123, 123, or tck123
                const numeric = input.replace(/[^0-9]/g, '');
                const normalized = input.toLowerCase();
                const selected = openTickets.find(t =>
                    (t.ticket_number && t.ticket_number.toLowerCase() === normalized) ||
                    String(t.id) === numeric
                );
                if (selected) {
                    await this.conversationStateService.setState(phoneNumber, {
                        currentStep: 'bound_to_ticket',
                        ticketType: stateResult.data.ticketType || null,
                        formData: stateResult.data.formData || {},
                        currentTicketId: selected.id
                    });
                    await this.whatsappService.sendMessage(phoneNumber, `You are now chatting on ticket ${selected.ticket_number || 'TCK-' + selected.id}. Send your message.`);
                    return { success: true, ticket: selected, message: 'Ticket selected', context: 'ticket_selected' };
                }
                await this.whatsappService.sendMessage(phoneNumber, 'Invalid selection. Enter a valid ticket number or reply NEW to create a ticket.');
                return { success: true, message: 'Awaiting valid selection' };
            }

            // First time showing open tickets: categorize and prompt
            const byType = openTickets.reduce((acc, t) => {
                const key = t.issue_type || 'other';
                (acc[key] = acc[key] || []).push(t);
                return acc;
            }, {});
            const formatLine = (t) => `• ${t.ticket_number || ('TCK-' + t.id)}${t.vehicle_number ? ' (' + t.vehicle_number + ')' : ''}`;
            const sections = [
                { label: 'Unlock', key: 'lock_open' },
                { label: 'Unlock Repair', key: 'lock_repair' },
                { label: 'Funding Request', key: 'fund_request' },
                { label: 'Fuel Request', key: 'fuel_request' },
                { label: 'Other', key: 'other' }
            ];
            const parts = [`There are already open tickets for the following tickets:`];
            for (const s of sections) {
                const list = (byType[s.key] || []).map(formatLine).join('\n') || '• None';
                parts.push(`\n${s.label} →\n${list}`);
            }
            parts.push(`\nReply:\nEnter the ticket number to continue the existing ticket. Or\nSelect New to create a new ticket for the following ticket:\n1. Unlock\n2. Unlock Repair\n3. Funding Request\n4. Fuel Request\n5. Other`);
            const responseMessage = parts.join('\n');

            await this.conversationStateService.setState(phoneNumber, {
                currentStep: 'awaiting_ticket_selection',
                ticketType: 'existing_tickets_shown',
                formData: { openTicketsCount: openTickets.length },
                currentTicketId: null
            });

            await this.whatsappService.sendMessage(phoneNumber, responseMessage);
            return { success: true, message: 'Open tickets shown to user', context: 'open_tickets_listed' };

        } catch (error) {
            console.error('[handleUserWithOpenTickets] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle new ticket creation flow
    async handleNewTicketFlow(phoneNumber, messageText, whatsappMessage) {
        try {
            console.log(`[handleNewTicketFlow] Starting new ticket flow for ${phoneNumber}`);
            
            // Check current conversation state
            const stateResult = await this.conversationStateService.getState(phoneNumber);
            
            if (!stateResult.success) {
                return { success: false, error: stateResult.error };
            }

            const currentState = stateResult.data;

            // If no active conversation, show ticket type menu
            if (!currentState) {
                return await this.showTicketTypeMenu(phoneNumber);
            }

            // Handle different conversation steps
            switch (currentState.currentStep) {
                case 'ticket_type_selection':
                    return await this.handleTicketTypeSelection(phoneNumber, messageText);
                
                case 'fuel_type_selection':
                    return await this.handleFuelTypeSelection(phoneNumber, messageText);
                
                case 'form_filling':
                    return await this.handleFormFilling(phoneNumber, messageText);
                
                default:
                    return await this.showTicketTypeMenu(phoneNumber);
            }

        } catch (error) {
            console.error('[handleNewTicketFlow] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Show ticket type selection menu
    async showTicketTypeMenu(phoneNumber) {
        try {
            console.log(`[showTicketTypeMenu] Showing ticket type menu to ${phoneNumber}`);
            
            const menuMessage = `Please select the type of ticket you want to create:\n\n1️⃣ Lock Open\n2️⃣ Lock Repair\n3️⃣ Fund Request\n4️⃣ Fuel Request\n5️⃣ Other\n\nPlease reply with the number (1-5) or the ticket type name.`;

            // Set state to ticket type selection
            await this.conversationStateService.setState(phoneNumber, {
                currentStep: 'ticket_type_selection',
                ticketType: null,
                formData: {},
                currentTicketId: null
            });

            // Send menu
            await this.whatsappService.sendMessage(phoneNumber, menuMessage);

            return { success: true, message: 'Ticket type menu sent' };

        } catch (error) {
            console.error('[showTicketTypeMenu] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle ticket type selection
    async handleTicketTypeSelection(phoneNumber, messageText) {
        try {
            console.log(`[handleTicketTypeSelection] User selected: ${messageText}`);
            
            let selectedType = null;
            const text = messageText.toLowerCase().trim();

            // Parse selection
            if (text.includes('1') || text.includes('lock open')) {
                selectedType = 'lock_open';
            } else if (text.includes('2') || text.includes('lock repair')) {
                selectedType = 'lock_repair';
            } else if (text.includes('3') || text.includes('fund request')) {
                selectedType = 'fund_request';
            } else if (text.includes('4') || text.includes('fuel request')) {
                selectedType = 'fuel_request';
            } else if (text.includes('5') || text.includes('other')) {
                selectedType = 'other';
            } else {
                // Invalid selection
                await this.whatsappService.sendMessage(phoneNumber, 
                    'Invalid selection. Please reply with a number (1-5) or the ticket type name.');
                return { success: true, message: 'Invalid selection, asking again' };
            }

            // Special handling for fuel request
            if (selectedType === 'fuel_request') {
                return await this.showFuelTypeMenu(phoneNumber, selectedType);
            }

            // Start form filling for other types
            return await this.startFormFilling(phoneNumber, selectedType);

        } catch (error) {
            console.error('[handleTicketTypeSelection] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Show fuel type selection menu
    async showFuelTypeMenu(phoneNumber, ticketType) {
        try {
            console.log(`[showFuelTypeMenu] Showing fuel type menu to ${phoneNumber}`);
            
            const menuMessage = `For Fuel Request, please select:\n\n1️⃣ By Amount\n2️⃣ By Quantity\n\nPlease reply with 1 or 2.`;

            // Set state to fuel type selection
            await this.conversationStateService.setState(phoneNumber, {
                currentStep: 'fuel_type_selection',
                ticketType: ticketType,
                formData: {},
                currentTicketId: null
            });

            // Send menu
            await this.whatsappService.sendMessage(phoneNumber, menuMessage);

            return { success: true, message: 'Fuel type menu sent' };

        } catch (error) {
            console.error('[showFuelTypeMenu] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle fuel type selection
    async handleFuelTypeSelection(phoneNumber, messageText) {
        try {
            console.log(`[handleFuelTypeSelection] User selected: ${messageText}`);
            
            const text = messageText.toLowerCase().trim();
            let fuelType = null;

            if (text.includes('1') || text.includes('amount')) {
                fuelType = 'amount';
            } else if (text.includes('2') || text.includes('quantity')) {
                fuelType = 'quantity';
            } else {
                // Invalid selection
                await this.whatsappService.sendMessage(phoneNumber, 
                    'Invalid selection. Please reply with 1 (By Amount) or 2 (By Quantity).');
                return { success: true, message: 'Invalid fuel type selection, asking again' };
            }

            // Update form data with fuel type
            await this.conversationStateService.updateFormData(phoneNumber, 'fuel_type', fuelType);

            // Start form filling
            return await this.startFormFilling(phoneNumber, 'fuel_request');

        } catch (error) {
            console.error('[handleFuelTypeSelection] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Start form filling process
    async startFormFilling(phoneNumber, ticketType) {
        try {
            console.log(`[startFormFilling] Starting form filling for ${ticketType}`);
            
            // Set state to form filling
            await this.conversationStateService.setState(phoneNumber, {
                currentStep: 'form_filling',
                ticketType: ticketType,
                formData: {},
                currentTicketId: null
            });

            // Get first field to fill
            const nextFieldResult = await this.conversationStateService.getNextFormField(phoneNumber);
            
            if (!nextFieldResult.success) {
                return { success: false, error: nextFieldResult.error };
            }

            if (nextFieldResult.data) {
                const field = nextFieldResult.data;
                const promptMessage = `Please provide ${field.fieldLabel}:`;
                
                await this.whatsappService.sendMessage(phoneNumber, promptMessage);
                
                return { success: true, message: `Asking for ${field.fieldName}` };
            }

            // No fields to fill (shouldn't happen)
            return { success: false, error: 'No form fields found for this ticket type' };

        } catch (error) {
            console.error('[startFormFilling] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle form filling
    async handleFormFilling(phoneNumber, messageText) {
        try {
            console.log(`[handleFormFilling] Processing form input: ${messageText}`);
            
            // Get next field to fill
            const nextFieldResult = await this.conversationStateService.getNextFormField(phoneNumber);
            
            if (!nextFieldResult.success) {
                return { success: false, error: nextFieldResult.error };
            }

            if (!nextFieldResult.data) {
                // Form is complete, create ticket
                return await this.completeTicketCreation(phoneNumber);
            }

            const field = nextFieldResult.data;
            
            // Validate field value
            const validation = this.conversationStateService.validateField(
                field.fieldName, 
                messageText, 
                field.validationRules
            );

            if (!validation.isValid) {
                await this.whatsappService.sendMessage(phoneNumber, 
                    `❌ ${validation.error}\n\nPlease provide ${field.fieldLabel}:`);
                return { success: true, message: 'Validation failed, asking again' };
            }

            // Save field value
            await this.conversationStateService.updateFormData(phoneNumber, field.fieldName, messageText);

            // Get next field
            const nextNextFieldResult = await this.conversationStateService.getNextFormField(phoneNumber);
            
            if (!nextNextFieldResult.success) {
                return { success: false, error: nextNextFieldResult.error };
            }

            if (nextNextFieldResult.data) {
                // Ask for next field
                const nextField = nextNextFieldResult.data;
                const promptMessage = `✅ ${field.fieldLabel} saved!\n\nPlease provide ${nextField.fieldLabel}:`;
                
                await this.whatsappService.sendMessage(phoneNumber, promptMessage);
                
                return { success: true, message: `Field ${field.fieldName} saved, asking for ${nextField.fieldName}` };
            } else {
                // Form is complete
                return await this.completeTicketCreation(phoneNumber);
            }

        } catch (error) {
            console.error('[handleFormFilling] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Complete ticket creation
    async completeTicketCreation(phoneNumber) {
        try {
            console.log(`[completeTicketCreation] Completing ticket creation for ${phoneNumber}`);
            
            // Get current state and form data
            const stateResult = await this.conversationStateService.getState(phoneNumber);
            
            if (!stateResult.success || !stateResult.data) {
                return { success: false, error: 'No active form found' };
            }

            const state = stateResult.data;
            const formData = state.formData;

            // Get customer info
            const customerResult = await Customer.findOrCreate(phoneNumber);
            if (!customerResult.success) {
                return { success: false, error: 'Failed to get customer info' };
            }

            // Prepare ticket data
            const ticketData = {
                phone_number: phoneNumber,
                customer_name: customerResult.data.name,
                issue_type: state.ticketType,
                vehicle_number: formData.vehicle_number || null,
                driver_number: formData.driver_number || null,
                location: formData.location || null,
                availability_date: formData.availability_date || null,
                availability_time: formData.availability_time || null,
                amount: formData.amount ? parseFloat(formData.amount) : null,
                upi_id: formData.upi_id || null,
                quantity: formData.quantity ? parseInt(formData.quantity) : null,
                fuel_type: formData.fuel_type || null,
                comment: formData.comment || null
            };

            // Create ticket
            const ticketResult = await this.createTicket(ticketData);
            
            if (!ticketResult.success) {
                return { success: false, error: ticketResult.error };
            }

            // Bind conversation to the created ticket
            await this.conversationStateService.setState(phoneNumber, {
                currentStep: 'bound_to_ticket',
                ticketType: state.ticketType,
                formData: {},
                currentTicketId: ticketResult.ticket.id
            });

            // Send success message
            const ensuredNumber = ticketResult.ticket.ticket_number || `TCK-${ticketResult.ticket.id}`;
            const successMessage = `✅ New ticket has been created!\n\nTicket number: ${ensuredNumber}\nType: ${state.ticketType}\n\nYou can now send messages to continue the conversation.`;
            
            await this.whatsappService.sendMessage(phoneNumber, successMessage);

            return { 
                success: true, 
                ticket: { ...ticketResult.ticket, ticket_number: ensuredNumber },
                message: 'Ticket created successfully' 
            };

        } catch (error) {
            console.error('[completeTicketCreation] Error:', error);
            return { success: false, error: error.message };
        }
    }

    // Handle message for existing ticket
    async handleExistingTicketMessage(phoneNumber, messageText, ticket, whatsappMessage) {
        try {
            console.log(`[handleExistingTicketMessage] Adding message to ticket ${ticket.ticket_number}`);
            
            // Save message to ticket
            const messageResult = await this.saveMessage(
                ticket.id, 
                'customer', 
                messageText, 
                'text', 
                whatsappMessage.id
            );

            if (!messageResult.success) {
                return { success: false, error: messageResult.error };
            }

            // Clear any conversation state
            await this.conversationStateService.clearState(phoneNumber);

            // Send acknowledgment
            const ackMessage = `Message received for ticket ${ticket.ticket_number}. Our team will respond soon.`;
            await this.whatsappService.sendMessage(phoneNumber, ackMessage);

            return { 
                success: true, 
                ticket: ticket,
                message: 'Message added to existing ticket' 
            };

        } catch (error) {
            console.error('[handleExistingTicketMessage] Error:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EnhancedTicketService;
