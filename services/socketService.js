const TicketService = require('./ticketService');
const WhatsAppService = require('./whatsappService');
const EnhancedTicketService = require('./enhancedTicketService');
const ConversationStateService = require('./conversationStateService');
const Customer = require('../models/Customer');
const Ticket = require('../models/Ticket');
const Message = require('../models/Message');

class SocketService {
    constructor(io) {
        this.io = io;
        this.ticketService = new TicketService();
        this.whatsappService = new WhatsAppService();
        this.enhancedTicketService = new EnhancedTicketService();
        this.conversationStateService = new ConversationStateService();
        this.activeConnections = new Map(); // Store active socket connections
        this.customerSessions = new Map(); // Store customer session states
        this.agentRooms = new Map(); // Store agent room mappings
        
        this.setupSocketHandlers();
    }

    setupSocketHandlers() {
        this.io.on('connection', (socket) => {
            console.log('✅ New socket connection:', socket.id);
            
            // Store connection info
            this.activeConnections.set(socket.id, {
                socket: socket,
                connectedAt: new Date(),
                type: null, // 'customer' or 'agent'
                userId: null,
                phoneNumber: null
            });

            // Handle customer connections
            socket.on('customerConnect', async (data) => {
                await this.handleCustomerConnection(socket, data);
            });

            // Handle agent connections
            socket.on('agentConnect', async (data) => {
                await this.handleAgentConnection(socket, data);
            });

            // Handle customer messages
            socket.on('customerMessage', async (data) => {
                await this.handleCustomerMessage(socket, data);
            });

            // Handle agent messages
            socket.on('agentMessage', async (data) => {
                await this.handleAgentMessage(socket, data);
            });

            // Handle interactive button responses
            socket.on('interactiveResponse', async (data) => {
                await this.handleInteractiveResponse(socket, data);
            });

            // Handle form step completion
            socket.on('formStepComplete', async (data) => {
                await this.handleFormStepComplete(socket, data);
            });

            // Handle agent actions
            socket.on('agentAction', async (data) => {
                await this.handleAgentAction(socket, data);
            });

            // Handle agent room joining
            socket.on('joinAgent', (agentId) => {
                this.handleJoinAgent(socket, agentId);
            });

            // Handle agent room leaving
            socket.on('leaveAgent', (agentId) => {
                this.handleLeaveAgent(socket, agentId);
            });

            // Handle disconnection
            socket.on('disconnect', () => {
                this.handleDisconnection(socket);
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error('Socket error:', error);
            });
        });
    }

    async handleCustomerConnection(socket, data) {
        try {
            const { phoneNumber, customerName } = data;
            
            if (!phoneNumber) {
                socket.emit('error', { message: 'Phone number is required' });
                return;
            }

            // Format phone number
            const formattedPhone = this.whatsappService.formatPhoneNumber(phoneNumber);
            
            // Find or create customer
            const customerResult = await Customer.findOrCreate(formattedPhone, customerName);
            if (!customerResult.success) {
                socket.emit('error', { message: 'Failed to create customer' });
                return;
            }

            const customer = customerResult.data;

            // Update connection info
            const connectionInfo = this.activeConnections.get(socket.id);
            connectionInfo.type = 'customer';
            connectionInfo.userId = customer.id;
            connectionInfo.phoneNumber = formattedPhone;

            // Join customer room
            socket.join(`customer_${customer.id}`);
            
            // Check for existing conversation state with selected ticket
            const stateResult = await this.conversationStateService.getState(formattedPhone);
            if (stateResult.success && stateResult.data && stateResult.data.currentTicketId) {
                // Customer has a selected ticket, restore the binding
                connectionInfo.selectedTicketId = stateResult.data.currentTicketId;
                const ticket = await Ticket.findById(stateResult.data.currentTicketId);
                const ensuredTicket = ticket ? { ...ticket, ticket_number: ticket.ticket_number || `TCK-${ticket.id}` } : null;
                
                socket.emit('customerConnected', {
                    success: true,
                    customer: customer,
                    existingTicket: ensuredTicket,
                    message: `Welcome back! You are connected to ticket ${ensuredTicket?.ticket_number || 'Unknown'}.`
                });
            } else {
                // Check for existing open tickets (list)
                const openResult = await this.conversationStateService.getOpenTickets(formattedPhone);
                if (openResult.success && openResult.data && openResult.data.length > 0) {
                    const openTickets = openResult.data;
                    socket.emit('customerConnected', {
                        success: true,
                        customer: customer,
                        existingTicket: null,
                        message: 'Welcome back! You have open tickets.'
                    });

                    // Build interactive list for selection with create-new option
                    const buttons = [
                        ...openTickets.slice(0, 10).map(t => ({
                            id: `select_ticket_${t.id}`,
                            title: `${t.ticket_number || ('TCK-' + t.id)}`
                        })),
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];
                    this.io.to(`customer_${customer.id}`).emit('interactiveMessage', {
                        type: 'buttons',
                        header: 'Open Tickets',
                        body: 'Select a ticket to continue or create a new one.',
                        footer: 'Choose an option below',
                        buttons
                    });
                } else {
                    // New customer
                    socket.emit('customerConnected', {
                        success: true,
                        customer: customer,
                        message: 'Welcome! How can we help you today?'
                    });

                    // Send initial interactive message
                    await this.sendInitialInteractiveMessage(customer);
                }
            }

            console.log(`✅ Customer connected: ${customer.phone_number} (${socket.id})`);

        } catch (error) {
            console.error('Error handling customer connection:', error);
            socket.emit('error', { message: 'Connection failed' });
        }
    }

    async handleAgentConnection(socket, data) {
        try {
            const { agentId, agentName } = data;
            
            if (!agentId) {
                socket.emit('error', { message: 'Agent ID is required' });
                return;
            }

            // Update connection info
            const connectionInfo = this.activeConnections.get(socket.id);
            connectionInfo.type = 'agent';
            connectionInfo.userId = agentId;

            // Join agent room and general agents room
            socket.join(`agent_${agentId}`);
            socket.join('agents');
            
            // Store agent room mapping
            this.agentRooms.set(agentId, socket.id);

            socket.emit('agentConnected', {
                success: true,
                agentId: agentId,
                message: 'Agent connected successfully'
            });

            // Notify other agents
            socket.to('agents').emit('agentJoined', {
                agentId: agentId,
                agentName: agentName || 'Agent'
            });

            console.log(`✅ Agent connected: ${agentId} (${socket.id})`);

        } catch (error) {
            console.error('Error handling agent connection:', error);
            socket.emit('error', { message: 'Agent connection failed' });
        }
    }

    handleJoinAgent(socket, agentId) {
        try {
            console.log(`🔗 Agent ${agentId} joining agent room (socket: ${socket.id})`);
            
            // Join agent-specific room
            socket.join(`agent_${agentId}`);
            
            // Join general agents room
            socket.join('agents');
            
            // Store agent room mapping
            this.agentRooms.set(agentId, socket.id);
            
            socket.emit('agentJoined', {
                success: true,
                agentId: agentId,
                message: `Joined agent room for agent ${agentId}`
            });
            
            console.log(`✅ Agent ${agentId} joined agent room successfully`);
            
        } catch (error) {
            console.error('Error handling join agent:', error);
            socket.emit('error', { message: 'Failed to join agent room' });
        }
    }

    handleLeaveAgent(socket, agentId) {
        try {
            console.log(`🔗 Agent ${agentId} leaving agent room (socket: ${socket.id})`);
            
            // Leave agent-specific room
            socket.leave(`agent_${agentId}`);
            
            // Leave general agents room
            socket.leave('agents');
            
            // Remove agent room mapping
            this.agentRooms.delete(agentId);
            
            socket.emit('agentLeft', {
                success: true,
                agentId: agentId,
                message: `Left agent room for agent ${agentId}`
            });
            
            console.log(`✅ Agent ${agentId} left agent room successfully`);
            
        } catch (error) {
            console.error('Error handling leave agent:', error);
            socket.emit('error', { message: 'Failed to leave agent room' });
        }
    }

    async handleCustomerMessage(socket, data) {
        try {
            const connectionInfo = this.activeConnections.get(socket.id);
            if (!connectionInfo || connectionInfo.type !== 'customer') {
                socket.emit('error', { message: 'Invalid customer connection' });
                return;
            }

            const { messageText, messageType = 'text' } = data;
            
            if (!messageText) {
                socket.emit('error', { message: 'Message text is required' });
                return;
            }

            // If user has selected a ticket via interactive selection, bind chat to it
            if (connectionInfo.selectedTicketId) {
                const save = await this.enhancedTicketService.saveMessage(
                    connectionInfo.selectedTicketId,
                    'customer',
                    messageText,
                    messageType,
                    `socket_${Date.now()}`
                );
                if (!save.success) {
                    socket.emit('error', { message: save.error || 'Failed to save message' });
                    return;
                }
                const ticket = await Ticket.findById(connectionInfo.selectedTicketId);
                const ensuredTicket = ticket ? { ...ticket, ticket_number: ticket.ticket_number || `TCK-${ticket.id}` } : null;
                // Notify the customer (ack)
                socket.emit('systemMessage', { message: `Message added to ticket ${ensuredTicket?.ticket_number}` });
                // Notify agents for the bound ticket
                this.io.to('agents').emit('newCustomerMessage', {
                    ticket: ensuredTicket,
                    message: { ...save.message, ticket_id: ensuredTicket?.id },
                    customer: { id: connectionInfo.userId, phone_number: connectionInfo.phoneNumber }
                });
                return;
            }

            // Otherwise use enhanced flow logic (WhatsApp-like prompts via socket-only system messages)
            const whatsappMessage = {
                id: `socket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                from: connectionInfo.phoneNumber,
                text: messageText,
                type: messageType,
                timestamp: Date.now().toString()
            };

            const result = await this.enhancedTicketService.processIncomingMessage(whatsappMessage);
            if (result.success) {
                if (result.context === 'open_tickets_listed') {
                    // Mirror the categorized list as buttons + create-new
                    // Re-fetch open tickets to build buttons
                    const openRes = await this.conversationStateService.getOpenTickets(connectionInfo.phoneNumber);
                    const openTickets = openRes.success ? openRes.data || [] : [];
                    const buttons = [
                        ...openTickets.slice(0, 10).map(t => ({ id: `select_ticket_${t.id}`, title: `${t.ticket_number || ('TCK-' + t.id)}` })),
                        { id: 'create_new_ticket', title: 'Create New Ticket' }
                    ];
                    socket.emit('interactiveMessage', {
                        type: 'buttons',
                        header: 'Open Tickets',
                        body: 'Select a ticket to continue or create a new one.',
                        footer: 'Choose an option below',
                        buttons
                    });
                } else if (result.context === 'ticket_selected') {
                    // Bind locally to the selection for subsequent messages
                    connectionInfo.selectedTicketId = result.ticket.id;
                    socket.emit('systemMessage', { message: `You are now chatting on ticket ${result.ticket.ticket_number || ('TCK-' + result.ticket.id)}` });
                } else if (result.ticket && result.message) {
                    // A message was persisted to a ticket
                    const ensuredTicket = { ...result.ticket, ticket_number: result.ticket.ticket_number || `TCK-${result.ticket.id}` };
                    this.io.to('agents').emit('newCustomerMessage', {
                        ticket: ensuredTicket,
                        message: { ...result.message, ticket_id: ensuredTicket.id },
                        customer: { id: connectionInfo.userId, phone_number: connectionInfo.phoneNumber }
                    });
                } else if (result.message) {
                    socket.emit('systemMessage', { message: result.message });
                }
            } else {
                socket.emit('error', { message: result.error || 'Failed to process message' });
            }

        } catch (error) {
            console.error('Error handling customer message:', error);
            socket.emit('error', { message: 'Failed to process message' });
        }
    }

    async handleAgentMessage(socket, data) {
        try {
            const connectionInfo = this.activeConnections.get(socket.id);
            if (!connectionInfo || connectionInfo.type !== 'agent') {
                socket.emit('error', { message: 'Invalid agent connection' });
                return;
            }

            const { ticketId, messageText } = data;
            
            if (!ticketId || !messageText) {
                socket.emit('error', { message: 'Ticket ID and message text are required' });
                return;
            }

            // Send agent reply using existing TicketService logic
            const result = await this.ticketService.sendAgentReply(
                ticketId, 
                connectionInfo.userId, 
                messageText
            );

            if (result.success) {
                // Notify the customer
                const ticket = await Ticket.findById(ticketId);
                if (ticket) {
                    this.io.to(`customer_${ticket.customer_id}`).emit('newAgentMessage', {
                        ticket: ticket,
                        message: { ...result.message, ticket_id: ticket.id },
                        agentId: connectionInfo.userId
                    });
                }

                // Notify all agents
                this.io.to('agents').emit('agentMessageSent', {
                    ticket: result.ticket,
                    message: { ...result.message, ticket_id: result.ticket?.id },
                    agentId: connectionInfo.userId
                });

                socket.emit('messageSent', {
                    success: true,
                    message: result.message,
                    ticket: result.ticket
                });
            } else {
                socket.emit('error', { message: result.error || 'Failed to send message' });
            }

        } catch (error) {
            console.error('Error handling agent message:', error);
            socket.emit('error', { 
                message: 'Failed to send message',
                error: error.message,
                details: error.toString()
            });
        }
    }

    async handleInteractiveResponse(socket, data) {
        try {
            const connectionInfo = this.activeConnections.get(socket.id);
            if (!connectionInfo || connectionInfo.type !== 'customer') {
                socket.emit('error', { message: 'Invalid customer connection' });
                return;
            }

            const { buttonId, buttonTitle } = data;
            
            // Custom handling for ticket selection / create new
            if (buttonId && buttonId.startsWith('select_ticket_')) {
                const ticketId = parseInt(buttonId.replace('select_ticket_', ''), 10);
                if (Number.isFinite(ticketId)) {
                    try {
                        connectionInfo.selectedTicketId = ticketId;
                        
                        // Persist the selection in conversation state
                        await this.conversationStateService.setSelectedTicket(connectionInfo.phoneNumber, ticketId);
                        
                        const ticket = await Ticket.findById(ticketId);
                        const ensured = ticket ? { ...ticket, ticket_number: ticket.ticket_number || `TCK-${ticket.id}` } : null;
                        
                        // Clear any existing conversation state since we're switching to an existing ticket
                        await this.conversationStateService.clearState(connectionInfo.phoneNumber);
                        
                        socket.emit('systemMessage', { message: `You are now chatting on ticket ${ensured?.ticket_number}` });
                        console.log(`✅ Customer ${connectionInfo.phoneNumber} selected ticket ${ticketId}`);
                        return;
                    } catch (error) {
                        console.error('Error selecting ticket:', error);
                        socket.emit('error', { message: 'Failed to select ticket' });
                        return;
                    }
                }
            }

            if (buttonId === 'create_new_ticket') {
                // Show ticket type selection menu via socket-only interactive message
                const buttons = [
                    { id: 'type_lock_open', title: 'Unlock' },
                    { id: 'type_lock_repair', title: 'Unlock Repair' },
                    { id: 'type_fund_request', title: 'Funding Request' },
                    { id: 'type_fuel_request', title: 'Fuel Request' },
                    { id: 'type_other', title: 'Other' }
                ];
                socket.emit('interactiveMessage', {
                    type: 'buttons',
                    header: 'Create New Ticket',
                    body: 'Select the type of ticket you want to create:',
                    footer: 'Choose an option below',
                    buttons
                });
                // Track in memory session
                this.customerSessions.set(`customer_${connectionInfo.userId}`, {
                    customerId: connectionInfo.userId,
                    currentStep: 'ticket_type_selection',
                    selectedCategory: null,
                    formData: {}
                });
                return;
            }

            // Handle fuel request sub-options
            if (buttonId === 'fuel_amount' || buttonId === 'fuel_quantity') {
                const fuelType = buttonId === 'fuel_amount' ? 'amount' : 'quantity';
                await this.conversationStateService.setState(connectionInfo.phoneNumber, {
                    currentStep: 'form_filling',
                    ticketType: 'fuel_request',
                    formData: { fuel_type: fuelType },
                    currentTicketId: null
                });
                
                // Get first form field for fuel request
                const nextField = await this.conversationStateService.getNextFormField(connectionInfo.phoneNumber);
                if (nextField.success && nextField.data) {
                    socket.emit('formStep', {
                        step: nextField.data.fieldName,
                        title: `Please provide ${nextField.data.fieldLabel}:`,
                        field: { 
                            name: nextField.data.fieldName, 
                            label: nextField.data.fieldLabel, 
                            type: nextField.data.fieldType || 'text', 
                            required: nextField.data.isRequired 
                        }
                    });
                } else {
                    socket.emit('systemMessage', { message: 'No form fields found for fuel request' });
                }
                return;
            }

            // Map type_* buttons back to enhanced flow start
            if (buttonId && buttonId.startsWith('type_')) {
                const mapping = {
                    'type_lock_open': 'lock_open',
                    'type_lock_repair': 'lock_repair',
                    'type_fund_request': 'fund_request',
                    'type_fuel_request': 'fuel_request',
                    'type_other': 'other'
                };
                const selected = mapping[buttonId];
                if (selected) {
                    // Clear any existing conversation state for new ticket creation
                    await this.conversationStateService.clearState(connectionInfo.phoneNumber);
                    
                    // Begin form filling via enhanced flow
                    if (selected === 'fuel_request') {
                        // Handle fuel request special flow
                        await this.conversationStateService.setState(connectionInfo.phoneNumber, {
                            currentStep: 'fuel_type_selection',
                            ticketType: selected,
                            formData: {},
                            currentTicketId: null
                        });
                        
                        const buttons = [
                            { id: 'fuel_amount', title: 'Amount' },
                            { id: 'fuel_quantity', title: 'Quantity' }
                        ];
                        socket.emit('interactiveMessage', {
                            type: 'buttons',
                            header: 'Fuel Request Type',
                            body: 'What type of fuel request do you want to make?',
                            footer: 'Choose an option below',
                            buttons
                        });
                    } else {
                        // Start form filling for other ticket types
                        await this.conversationStateService.setState(connectionInfo.phoneNumber, {
                            currentStep: 'form_filling',
                            ticketType: selected,
                            formData: {},
                            currentTicketId: null
                        });
                        
                        // Get first form field and emit it
                        const nextField = await this.conversationStateService.getNextFormField(connectionInfo.phoneNumber);
                        if (nextField.success && nextField.data) {
                            socket.emit('formStep', {
                                step: nextField.data.fieldName,
                                title: `Please provide ${nextField.data.fieldLabel}:`,
                                field: { 
                                    name: nextField.data.fieldName, 
                                    label: nextField.data.fieldLabel, 
                                    type: nextField.data.fieldType || 'text', 
                                    required: nextField.data.isRequired 
                                }
                            });
                        } else {
                            socket.emit('systemMessage', { message: 'No form fields found for this ticket type' });
                        }
                    }
                    return;
                }
            }

            // Fallback to existing interactive processing
            const result = await this.processInteractiveResponse(
                connectionInfo.userId, 
                buttonId, 
                buttonTitle
            );

            if (result.success) {
                socket.emit('interactiveResponseProcessed', result);
                this.io.to('agents').emit('customerInteractiveResponse', {
                    customerId: connectionInfo.userId,
                    buttonId: buttonId,
                    buttonTitle: buttonTitle,
                    result: result
                });
            } else {
                socket.emit('error', { message: result.error || 'Failed to process response' });
            }

        } catch (error) {
            console.error('Error handling interactive response:', error);
            socket.emit('error', { message: 'Failed to process response' });
        }
    }

    async handleFormStepComplete(socket, data) {
        try {
            const connectionInfo = this.activeConnections.get(socket.id);
            if (!connectionInfo || connectionInfo.type !== 'customer') {
                socket.emit('error', { message: 'Invalid customer connection' });
                return;
            }

            const { step, stepData } = data;
            
            // Update form data in conversation state
            for (const [fieldName, fieldValue] of Object.entries(stepData)) {
                await this.conversationStateService.updateFormData(connectionInfo.phoneNumber, fieldName, fieldValue);
            }

            // Check if form is complete
            const isComplete = await this.conversationStateService.isFormComplete(connectionInfo.phoneNumber);
            
            if (isComplete) {
                // Form is complete, create the ticket
                const result = await this.enhancedTicketService.completeTicketCreation(connectionInfo.phoneNumber);
                
                if (result.success && result.ticket) {
                    const ensuredTicket = { 
                        ...result.ticket, 
                        ticket_number: result.ticket.ticket_number || `TCK-${result.ticket.id}` 
                    };
                    
                    // Bind the customer to this ticket
                    connectionInfo.selectedTicketId = result.ticket.id;
                    await this.conversationStateService.setSelectedTicket(connectionInfo.phoneNumber, result.ticket.id);
                    
                    // Notify customer
                    socket.emit('ticketCreated', {
                        ticket: ensuredTicket,
                        message: result.message
                    });
                    
                    // Notify agents
                    this.io.to('agents').emit('newTicket', {
                        ticket: ensuredTicket,
                        customer: { id: connectionInfo.userId, phone_number: connectionInfo.phoneNumber }
                    });
                } else {
                    socket.emit('error', { message: result.error || 'Failed to create ticket' });
                }
            } else {
                // Get next form field
                const nextField = await this.conversationStateService.getNextFormField(connectionInfo.phoneNumber);
                if (nextField.success && nextField.data) {
                    socket.emit('formStep', {
                        step: nextField.data.fieldName,
                        title: `Please provide ${nextField.data.fieldLabel}:`,
                        field: { 
                            name: nextField.data.fieldName, 
                            label: nextField.data.fieldLabel, 
                            type: nextField.data.fieldType || 'text', 
                            required: nextField.data.isRequired 
                        }
                    });
                } else {
                    socket.emit('error', { message: 'Failed to get next form field' });
                }
            }

        } catch (error) {
            console.error('Error handling form step:', error);
            socket.emit('error', { message: 'Failed to process form step' });
        }
    }

    async handleAgentAction(socket, data) {
        try {
            const connectionInfo = this.activeConnections.get(socket.id);
            if (!connectionInfo || connectionInfo.type !== 'agent') {
                socket.emit('error', { message: 'Invalid agent connection' });
                return;
            }

            const { action, ticketId, data: actionData } = data;
            
            let result;
            switch (action) {
                case 'assign':
                    result = await this.handleTicketAssignment(ticketId, connectionInfo.userId);
                    break;
                case 'close':
                    result = await this.handleTicketClosure(ticketId, connectionInfo.userId);
                    break;
                case 'updateStatus':
                    result = await this.handleStatusUpdate(ticketId, actionData.status, connectionInfo.userId);
                    break;
                default:
                    socket.emit('error', { message: 'Unknown action' });
                    return;
            }

            if (result.success) {
                // Notify all agents
                this.io.to('agents').emit('agentActionCompleted', {
                    action: action,
                    ticket: result.ticket,
                    agentId: connectionInfo.userId
                });

                // Notify customer if relevant
                if (result.ticket && result.ticket.customer_id) {
                    this.io.to(`customer_${result.ticket.customer_id}`).emit('ticketUpdated', {
                        action: action,
                        ticket: result.ticket
                    });
                }

                socket.emit('actionCompleted', {
                    success: true,
                    action: action,
                    result: result
                });
            } else {
                socket.emit('error', { message: result.error || 'Failed to complete action' });
            }

        } catch (error) {
            console.error('Error handling agent action:', error);
            socket.emit('error', { message: 'Failed to complete action' });
        }
    }

    handleDisconnection(socket) {
        const connectionInfo = this.activeConnections.get(socket.id);
        
        if (connectionInfo) {
            console.log(`❌ Socket disconnected: ${connectionInfo.type} (${socket.id})`);
            
            if (connectionInfo.type === 'agent') {
                // Notify other agents
                this.io.to('agents').emit('agentDisconnected', {
                    agentId: connectionInfo.userId
                });
                
                // Remove from agent rooms
                this.agentRooms.delete(connectionInfo.userId);
            }
            
            // Remove from active connections
            this.activeConnections.delete(socket.id);
        }
    }

    async sendInitialInteractiveMessage(customer) {
        try {
            const buttons = [
                { id: 'lock_open', title: 'Lock Open' },
                { id: 'lock_repair', title: 'Lock Repair' },
                { id: 'fund_request', title: 'Fund Request' },
                { id: 'fuel_request', title: 'Fuel Request' },
                { id: 'other', title: 'Other' }
            ];

            // Send interactive message to customer
            this.io.to(`customer_${customer.id}`).emit('interactiveMessage', {
                type: 'buttons',
                header: 'Welcome to our Support System',
                body: 'Please select the type of service you need:',
                footer: 'Choose an option below',
                buttons: buttons
            });

            // Also send via WhatsApp if configured
            const whatsappResult = await this.whatsappService.sendInteractiveMessage(
                customer.phone_number,
                'Welcome to our Support System',
                'Please select the type of service you need:',
                'Choose an option below',
                buttons
            );

            return { success: true, whatsappResult };

        } catch (error) {
            console.error('Error sending initial interactive message:', error);
            return { success: false, error: error.message };
        }
    }

    async processInteractiveResponse(customerId, buttonId, buttonTitle) {
        try {
            // Update customer session state
            const sessionKey = `customer_${customerId}`;
            let sessionState = this.customerSessions.get(sessionKey) || {
                customerId: customerId,
                currentStep: 'initial',
                selectedCategory: null,
                formData: {}
            };

            sessionState.selectedCategory = buttonId;
            sessionState.currentStep = 'category_selected';
            sessionState.formData.category = buttonTitle;

            this.customerSessions.set(sessionKey, sessionState);

            // Send next step based on category
            let nextStep;
            switch (buttonId) {
                case 'fund_request':
                case 'fuel_request':
                    nextStep = await this.sendAmountOrQuantityStep(customerId, buttonId);
                    break;
                default:
                    nextStep = await this.sendVehicleDetailsStep(customerId);
                    break;
            }

            return { success: true, nextStep: nextStep };

        } catch (error) {
            console.error('Error processing interactive response:', error);
            return { success: false, error: error.message };
        }
    }

    async sendVehicleDetailsStep(customerId) {
        try {
            this.io.to(`customer_${customerId}`).emit('formStep', {
                step: 'vehicle_details',
                title: 'Vehicle Information',
                fields: [
                    { name: 'vehicle_number', label: 'Vehicle Number', type: 'text', required: true },
                    { name: 'driver_number', label: 'Driver License Number', type: 'text', required: true },
                    { name: 'location', label: 'Location', type: 'text', required: true }
                ]
            });

            return { step: 'vehicle_details' };
        } catch (error) {
            console.error('Error sending vehicle details step:', error);
            return { error: error.message };
        }
    }

    async sendAmountOrQuantityStep(customerId, requestType) {
        try {
            const isFuelRequest = requestType === 'fuel_request';
            
            this.io.to(`customer_${customerId}`).emit('formStep', {
                step: 'amount_quantity',
                title: isFuelRequest ? 'Fuel Request Details' : 'Fund Request Details',
                fields: [
                    { name: 'vehicle_number', label: 'Vehicle Number', type: 'text', required: true },
                    { name: 'driver_number', label: 'Driver License Number', type: 'text', required: true },
                    { name: 'location', label: 'Location', type: 'text', required: true },
                    isFuelRequest 
                        ? { name: 'quantity', label: 'Fuel Quantity (Liters)', type: 'number', required: true }
                        : { name: 'amount', label: 'Amount (₹)', type: 'number', required: true },
                    { name: 'upi_id', label: 'UPI ID', type: 'text', required: true }
                ]
            });

            return { step: 'amount_quantity' };
        } catch (error) {
            console.error('Error sending amount/quantity step:', error);
            return { error: error.message };
        }
    }

    async processFormStep(customerId, step, stepData) {
        try {
            const sessionKey = `customer_${customerId}`;
            let sessionState = this.customerSessions.get(sessionKey) || {
                customerId: customerId,
                currentStep: 'initial',
                selectedCategory: null,
                formData: {}
            };

            // Update form data
            sessionState.formData = { ...sessionState.formData, ...stepData };
            sessionState.currentStep = step;

            this.customerSessions.set(sessionKey, sessionState);

            // Check if form is complete
            if (this.isFormComplete(sessionState)) {
                return await this.createTicketFromFormData(customerId, sessionState);
            } else {
                // Send next step
                return await this.sendNextFormStep(customerId, sessionState);
            }

        } catch (error) {
            console.error('Error processing form step:', error);
            return { success: false, error: error.message };
        }
    }

    isFormComplete(sessionState) {
        const { formData, selectedCategory } = sessionState;
        
        // Basic required fields
        const hasBasicInfo = formData.vehicle_number && formData.driver_number && formData.location;
        
        if (!hasBasicInfo) return false;

        // Category-specific requirements
        switch (selectedCategory) {
            case 'fund_request':
                return formData.amount && formData.upi_id;
            case 'fuel_request':
                return formData.quantity && formData.upi_id;
            default:
                return true; // Other categories just need basic info
        }
    }

    async createTicketFromFormData(customerId, sessionState) {
        try {
            const { formData, selectedCategory } = sessionState;
            
            // Create ticket data
            const ticketData = {
                customer_id: customerId,
                issue_type: selectedCategory,
                vehicle_number: formData.vehicle_number,
                driver_number: formData.driver_number,
                location: formData.location,
                amount: formData.amount || null,
                quantity: formData.quantity || null,
                upi_id: formData.upi_id || null,
                comment: formData.comment || 'Ticket created via interactive form'
            };

            const ticketResult = await Ticket.create(ticketData);
            
            if (ticketResult.success) {
                const ticket = ticketResult.data;
                
                // Clear session
                this.customerSessions.delete(`customer_${customerId}`);
                
                // Notify customer
                this.io.to(`customer_${customerId}`).emit('ticketCreated', {
                    success: true,
                    ticket: ticket,
                    message: `Your ticket #${ticket.ticket_number} has been created successfully!`
                });

                // Notify agents
                this.io.to('agents').emit('newTicketCreated', {
                    ticket: ticket,
                    customerId: customerId
                });

                return { success: true, ticket: ticket };
            } else {
                return { success: false, error: ticketResult.error };
            }

        } catch (error) {
            console.error('Error creating ticket from form data:', error);
            return { success: false, error: error.message };
        }
    }

    async sendNextFormStep(customerId, sessionState) {
        try {
            const { currentStep, selectedCategory, formData } = sessionState;
            
            // Determine next step based on current state
            let nextStep;
            
            if (!formData.vehicle_number) {
                nextStep = 'vehicle_number';
            } else if (!formData.driver_number) {
                nextStep = 'driver_number';
            } else if (!formData.location) {
                nextStep = 'location';
            } else if (selectedCategory === 'fund_request' && !formData.amount) {
                nextStep = 'amount';
            } else if (selectedCategory === 'fuel_request' && !formData.quantity) {
                nextStep = 'quantity';
            } else if ((selectedCategory === 'fund_request' || selectedCategory === 'fuel_request') && !formData.upi_id) {
                nextStep = 'upi_id';
            } else {
                nextStep = 'comment';
            }

            // Send appropriate form step
            switch (nextStep) {
                case 'vehicle_number':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'vehicle_number',
                        title: 'Vehicle Number',
                        field: { name: 'vehicle_number', label: 'Enter Vehicle Number', type: 'text', required: true }
                    });
                    break;
                case 'driver_number':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'driver_number',
                        title: 'Driver Information',
                        field: { name: 'driver_number', label: 'Enter Driver License Number', type: 'text', required: true }
                    });
                    break;
                case 'location':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'location',
                        title: 'Location',
                        field: { name: 'location', label: 'Enter Location', type: 'text', required: true }
                    });
                    break;
                case 'amount':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'amount',
                        title: 'Amount',
                        field: { name: 'amount', label: 'Enter Amount (₹)', type: 'number', required: true }
                    });
                    break;
                case 'quantity':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'quantity',
                        title: 'Fuel Quantity',
                        field: { name: 'quantity', label: 'Enter Fuel Quantity (Liters)', type: 'number', required: true }
                    });
                    break;
                case 'upi_id':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'upi_id',
                        title: 'UPI ID',
                        field: { name: 'upi_id', label: 'Enter UPI ID', type: 'text', required: true }
                    });
                    break;
                case 'comment':
                    this.io.to(`customer_${customerId}`).emit('formStep', {
                        step: 'comment',
                        title: 'Additional Comments',
                        field: { name: 'comment', label: 'Any additional comments?', type: 'textarea', required: false }
                    });
                    break;
            }

            return { success: true, nextStep: nextStep };

        } catch (error) {
            console.error('Error sending next form step:', error);
            return { success: false, error: error.message };
        }
    }

    async handleTicketAssignment(ticketId, agentId) {
        try {
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const result = await ticket.assignToAgent(agentId);
            
            if (result.success) {
                return { success: true, ticket: ticket };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('Error handling ticket assignment:', error);
            return { success: false, error: error.message };
        }
    }

    async handleTicketClosure(ticketId, agentId) {
        try {
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const result = await ticket.close();
            
            if (result.success) {
                return { success: true, ticket: ticket };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('Error handling ticket closure:', error);
            return { success: false, error: error.message };
        }
    }

    async handleStatusUpdate(ticketId, status, agentId) {
        try {
            const ticket = await Ticket.findById(ticketId);
            if (!ticket) {
                return { success: false, error: 'Ticket not found' };
            }

            const result = await ticket.updateStatus(status, agentId);
            
            if (result.success) {
                return { success: true, ticket: ticket };
            } else {
                return { success: false, error: result.error };
            }

        } catch (error) {
            console.error('Error handling status update:', error);
            return { success: false, error: error.message };
        }
    }

    // Utility methods
    getActiveConnections() {
        return Array.from(this.activeConnections.values());
    }

    getCustomerSessions() {
        return Array.from(this.customerSessions.values());
    }

    getAgentRooms() {
        return Array.from(this.agentRooms.entries());
    }

    // Broadcast to all agents
    broadcastToAgents(event, data) {
        this.io.to('agents').emit(event, data);
    }

    // Broadcast updated stats for a specific customer to all agents
    async broadcastCustomerStats(customerId) {
        try {
            const Customer = require('../models/Customer');
            // Fetch single customer with stats
            const query = `
                SELECT 
                    c.id,
                    c.phone_number,
                    c.name,
                    c.created_at,
                    COUNT(DISTINCT CASE WHEN t.status IN ('open', 'in_progress', 'pending_customer', 'closed') THEN t.id END) as total_tickets,
                    COUNT(DISTINCT CASE WHEN t.status IN ('open', 'in_progress', 'pending_customer') THEN t.id END) as open_tickets,
                    COUNT(DISTINCT CASE WHEN t.status IN ('in_progress') THEN t.id END) as in_progress_tickets,
                    COUNT(DISTINCT CASE WHEN t.status IN ('closed') THEN t.id END) as closed_tickets,
                    COUNT(DISTINCT CASE WHEN m.sender_type = 'customer' AND m.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN m.id END) as pending_chats
                FROM customers c
                LEFT JOIN tickets t ON c.id = t.customer_id
                LEFT JOIN messages m ON c.phone_number = m.phone_number
                WHERE c.id = ?
                GROUP BY c.id, c.phone_number, c.name, c.created_at
                LIMIT 1
            `;
            const { executeQuery } = require('../config/database');
            const res = await executeQuery(query, [customerId]);
            if (res.success && res.data.length > 0) {
                this.broadcastToAgents('customerUpdated', res.data[0]);
            }
        } catch (e) {
            console.warn('broadcastCustomerStats failed:', e.message);
        }
    }

    // Broadcast global aggregated stats for dashboard header
    async broadcastDashboardStats() {
        try {
            const { executeQuery } = require('../config/database');
            const statsQuery = `
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status IN ('open','in_progress','pending_customer') THEN 1 ELSE 0 END) as open,
                    SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed
                FROM tickets
            `;
            const res = await executeQuery(statsQuery, []);
            if (res.success && res.data.length > 0) {
                this.broadcastToAgents('dashboardStats', res.data[0]);
            }
        } catch (e) {
            console.warn('broadcastDashboardStats failed:', e.message);
        }
    }

    // Send to specific customer
    sendToCustomer(customerId, event, data) {
        this.io.to(`customer_${customerId}`).emit(event, data);
    }

    // Send to specific agent
    sendToAgent(agentId, event, data) {
        this.io.to(`agent_${agentId}`).emit(event, data);
    }
}

module.exports = SocketService;
