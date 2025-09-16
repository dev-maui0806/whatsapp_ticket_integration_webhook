const EnhancedTicketService = require('./services/enhancedTicketService');
const ConversationStateService = require('./services/conversationStateService');
const { executeQuery } = require('./config/database');

class TicketingSystemTester {
    constructor() {
        this.enhancedTicketService = new EnhancedTicketService();
        this.conversationStateService = new ConversationStateService();
        this.testPhoneNumber = '1234567890';
    }

    async runAllTests() {
        console.log('🧪 Starting Enhanced Ticketing System Tests\n');
        
        try {
            // Test 1: Check open tickets (should be empty initially)
            await this.testCheckOpenTickets();
            
            // Test 2: Test conversation state management
            await this.testConversationStateManagement();
            
            // Test 3: Test ticket type selection
            await this.testTicketTypeSelection();
            
            // Test 4: Test form filling for Lock Open
            await this.testLockOpenForm();
            
            // Test 5: Test form filling for Fund Request
            await this.testFundRequestForm();
            
            // Test 6: Test form filling for Fuel Request
            await this.testFuelRequestForm();
            
            // Test 7: Test form filling for Other
            await this.testOtherForm();
            
            // Test 8: Test message saving
            await this.testMessageSaving();
            
            // Test 9: Test open tickets after creation
            await this.testCheckOpenTicketsAfterCreation();
            
            console.log('\n✅ All tests completed successfully!');
            
        } catch (error) {
            console.error('\n❌ Test failed:', error);
        }
    }

    async testCheckOpenTickets() {
        console.log('📋 Test 1: Check Open Tickets (Initial)');
        
        const result = await this.enhancedTicketService.checkOpenTickets(this.testPhoneNumber);
        
        if (result.success && !result.hasOpenTickets) {
            console.log('✅ No open tickets found (expected)');
        } else {
            console.log('❌ Unexpected result:', result);
        }
        console.log('');
    }

    async testConversationStateManagement() {
        console.log('🔄 Test 2: Conversation State Management');
        
        // Test setting state
        const setResult = await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'ticket_type_selection',
            ticketType: 'lock_open',
            formData: { test: 'value' },
            currentTicketId: null
        });
        
        if (setResult.success) {
            console.log('✅ State set successfully');
        } else {
            console.log('❌ Failed to set state:', setResult.error);
            return;
        }
        
        // Test getting state
        const getResult = await this.conversationStateService.getState(this.testPhoneNumber);
        
        if (getResult.success && getResult.data) {
            console.log('✅ State retrieved successfully:', getResult.data.currentStep);
        } else {
            console.log('❌ Failed to get state:', getResult.error);
        }
        
        // Test clearing state
        const clearResult = await this.conversationStateService.clearState(this.testPhoneNumber);
        
        if (clearResult.success) {
            console.log('✅ State cleared successfully');
        } else {
            console.log('❌ Failed to clear state:', clearResult.error);
        }
        console.log('');
    }

    async testTicketTypeSelection() {
        console.log('🎯 Test 3: Ticket Type Selection');
        
        // Test setting ticket type
        await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'ticket_type_selection',
            ticketType: 'lock_open',
            formData: {},
            currentTicketId: null
        });
        
        // Test getting next form field
        const nextFieldResult = await this.conversationStateService.getNextFormField(this.testPhoneNumber);
        
        if (nextFieldResult.success && nextFieldResult.data) {
            console.log('✅ Next form field retrieved:', nextFieldResult.data.fieldName);
        } else {
            console.log('❌ Failed to get next form field:', nextFieldResult.error);
        }
        
        await this.conversationStateService.clearState(this.testPhoneNumber);
        console.log('');
    }

    async testLockOpenForm() {
        console.log('🔓 Test 4: Lock Open Form');
        
        // Set up form state
        await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'form_filling',
            ticketType: 'lock_open',
            formData: {},
            currentTicketId: null
        });
        
        // Fill form fields
        const fields = [
            { name: 'vehicle_number', value: 'ABC123' },
            { name: 'driver_number', value: 'DRV001' },
            { name: 'location', value: 'Main Street, City' },
            { name: 'comment', value: 'Lock is stuck' }
        ];
        
        for (const field of fields) {
            await this.conversationStateService.updateFormData(this.testPhoneNumber, field.name, field.value);
            console.log(`✅ Field ${field.name} updated: ${field.value}`);
        }
        
        // Check if form is complete
        const isComplete = await this.conversationStateService.isFormComplete(this.testPhoneNumber);
        console.log(`✅ Form complete: ${isComplete}`);
        
        await this.conversationStateService.clearState(this.testPhoneNumber);
        console.log('');
    }

    async testFundRequestForm() {
        console.log('💰 Test 5: Fund Request Form');
        
        // Set up form state
        await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'form_filling',
            ticketType: 'fund_request',
            formData: {},
            currentTicketId: null
        });
        
        // Fill form fields
        const fields = [
            { name: 'vehicle_number', value: 'XYZ789' },
            { name: 'driver_number', value: 'DRV002' },
            { name: 'amount', value: '5000' },
            { name: 'upi_id', value: 'driver@upi' },
            { name: 'comment', value: 'Need funds for fuel' }
        ];
        
        for (const field of fields) {
            await this.conversationStateService.updateFormData(this.testPhoneNumber, field.name, field.value);
            console.log(`✅ Field ${field.name} updated: ${field.value}`);
        }
        
        // Check if form is complete
        const isComplete = await this.conversationStateService.isFormComplete(this.testPhoneNumber);
        console.log(`✅ Form complete: ${isComplete}`);
        
        await this.conversationStateService.clearState(this.testPhoneNumber);
        console.log('');
    }

    async testFuelRequestForm() {
        console.log('⛽ Test 6: Fuel Request Form');
        
        // Set up form state with fuel type
        await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'form_filling',
            ticketType: 'fuel_request',
            formData: { fuel_type: 'amount' },
            currentTicketId: null
        });
        
        // Fill form fields for amount-based fuel request
        const fields = [
            { name: 'vehicle_number', value: 'DEF456' },
            { name: 'driver_number', value: 'DRV003' },
            { name: 'amount', value: '2000' },
            { name: 'upi_id', value: 'driver3@upi' },
            { name: 'comment', value: 'Need fuel for long trip' }
        ];
        
        for (const field of fields) {
            await this.conversationStateService.updateFormData(this.testPhoneNumber, field.name, field.value);
            console.log(`✅ Field ${field.name} updated: ${field.value}`);
        }
        
        // Check if form is complete
        const isComplete = await this.conversationStateService.isFormComplete(this.testPhoneNumber);
        console.log(`✅ Form complete: ${isComplete}`);
        
        await this.conversationStateService.clearState(this.testPhoneNumber);
        console.log('');
    }

    async testOtherForm() {
        console.log('📝 Test 7: Other Form');
        
        // Set up form state
        await this.conversationStateService.setState(this.testPhoneNumber, {
            currentStep: 'form_filling',
            ticketType: 'other',
            formData: {},
            currentTicketId: null
        });
        
        // Fill form fields
        const fields = [
            { name: 'comment', value: 'General inquiry about services' }
        ];
        
        for (const field of fields) {
            await this.conversationStateService.updateFormData(this.testPhoneNumber, field.name, field.value);
            console.log(`✅ Field ${field.name} updated: ${field.value}`);
        }
        
        // Check if form is complete
        const isComplete = await this.conversationStateService.isFormComplete(this.testPhoneNumber);
        console.log(`✅ Form complete: ${isComplete}`);
        
        await this.conversationStateService.clearState(this.testPhoneNumber);
        console.log('');
    }

    async testMessageSaving() {
        console.log('💬 Test 8: Message Saving');
        
        // First create a test ticket
        const ticketData = {
            phone_number: this.testPhoneNumber,
            issue_type: 'other',
            comment: 'Test ticket for message saving'
        };
        
        const ticketResult = await this.enhancedTicketService.createTicket(ticketData);
        
        if (ticketResult.success) {
            console.log('✅ Test ticket created:', ticketResult.ticket.ticket_number);
            
            // Test saving message
            const messageResult = await this.enhancedTicketService.saveMessage(
                ticketResult.ticket.id,
                'customer',
                'This is a test message',
                'text',
                'test_whatsapp_id'
            );
            
            if (messageResult.success) {
                console.log('✅ Message saved successfully');
            } else {
                console.log('❌ Failed to save message:', messageResult.error);
            }
        } else {
            console.log('❌ Failed to create test ticket:', ticketResult.error);
        }
        console.log('');
    }

    async testCheckOpenTicketsAfterCreation() {
        console.log('📋 Test 9: Check Open Tickets (After Creation)');
        
        const result = await this.enhancedTicketService.checkOpenTickets(this.testPhoneNumber);
        
        if (result.success && result.hasOpenTickets) {
            console.log(`✅ Found ${result.tickets.length} open ticket(s):`);
            result.tickets.forEach(ticket => {
                console.log(`   - ${ticket.ticket_number}: ${ticket.issue_type} (${ticket.status})`);
            });
        } else {
            console.log('❌ No open tickets found (unexpected)');
        }
        console.log('');
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new TicketingSystemTester();
    tester.runAllTests().then(() => {
        console.log('🎉 Testing completed!');
        process.exit(0);
    }).catch(error => {
        console.error('💥 Testing failed:', error);
        process.exit(1);
    });
}

module.exports = TicketingSystemTester;
