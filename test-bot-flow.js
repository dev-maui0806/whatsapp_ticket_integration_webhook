const BotConversationService = require('./services/botConversationService');
const { executeQuery } = require('./config/database');

async function testBotFlow() {
    console.log('🤖 Testing Bot Conversation Flow...');
    console.log('=====================================');
    
    const botService = new BotConversationService();
    const testPhoneNumber = '918826000390';
    
    try {
        // Test 1: Initial greeting
        console.log('\n📱 Test 1: Initial Greeting');
        console.log('----------------------------');
        
        const greetingResult = await botService.handleInitialGreeting(testPhoneNumber, 'HELLO', 'Test Customer');
        console.log('✅ Greeting Result:', greetingResult);
        
        if (greetingResult.success) {
            console.log('✅ Initial greeting handled successfully');
            console.log('📝 Bot Message:', greetingResult.message);
        } else {
            console.log('❌ Initial greeting failed:', greetingResult.error);
        }
        
        // Test 2: /start command (new customer)
        console.log('\n🚀 Test 2: /start Command (New Customer)');
        console.log('----------------------------------------');
        
        const startResult = await botService.handleStartCommand(testPhoneNumber);
        console.log('✅ Start Result:', startResult);
        
        if (startResult.success) {
            console.log('✅ /start command handled successfully');
            console.log('📝 Bot Message:', startResult.message);
            console.log('📊 Has Existing Tickets:', startResult.hasExistingTickets);
        } else {
            console.log('❌ /start command failed:', startResult.error);
        }
        
        // Test 3: Select "Create New Ticket" (option 1)
        console.log('\n🎫 Test 3: Select "Create New Ticket"');
        console.log('-------------------------------------');
        
        const newTicketResult = await botService.handleNewTicketSelection(testPhoneNumber, '1');
        console.log('✅ New Ticket Result:', newTicketResult);
        
        if (newTicketResult.success) {
            console.log('✅ New ticket selection handled successfully');
            console.log('📝 Bot Message:', newTicketResult.message);
            console.log('🎯 Action:', newTicketResult.action);
        } else {
            console.log('❌ New ticket selection failed:', newTicketResult.error);
        }
        
        // Test 4: Select ticket type (option 1 - Unlock)
        console.log('\n🔧 Test 4: Select Ticket Type (Unlock)');
        console.log('---------------------------------------');
        
        const ticketTypeResult = await botService.handleTicketTypeSelection(testPhoneNumber, '1');
        console.log('✅ Ticket Type Result:', ticketTypeResult);
        
        if (ticketTypeResult.success) {
            console.log('✅ Ticket type selection handled successfully');
            console.log('📝 Bot Message:', ticketTypeResult.message);
            console.log('🎫 Ticket Type:', ticketTypeResult.ticketType);
        } else {
            console.log('❌ Ticket type selection failed:', ticketTypeResult.error);
        }
        
        // Test 5: Form filling
        console.log('\n📝 Test 5: Form Filling');
        console.log('----------------------');
        
        const formData = {
            vehicle_number: 'HR55J2345',
            driver_number: '9876543210',
            location: 'Delhi',
            comment: 'Lock is stuck'
        };
        
        const formInput = `${formData.vehicle_number}, ${formData.driver_number}, ${formData.location}, ${formData.comment}`;
        
        const formResult = await botService.handleFormFilling(testPhoneNumber, formInput, 'lock_open', {});
        console.log('✅ Form Result:', formResult);
        
        if (formResult.success) {
            console.log('✅ Form filling handled successfully');
            console.log('📝 Bot Message:', formResult.message);
            console.log('🎯 Action:', formResult.action);
            console.log('📊 Form Data:', formResult.formData);
        } else {
            console.log('❌ Form filling failed:', formResult.error);
        }
        
        // Test 6: Complete ticket creation
        console.log('\n✅ Test 6: Complete Ticket Creation');
        console.log('----------------------------------');
        
        const completeResult = await botService.handleFormFilling(testPhoneNumber, '/input_end', 'lock_open', formData);
        console.log('✅ Complete Result:', completeResult);
        
        if (completeResult.success) {
            console.log('✅ Ticket creation completed successfully');
            console.log('📝 Bot Message:', completeResult.message);
            console.log('🎫 Ticket:', completeResult.ticket);
        } else {
            console.log('❌ Ticket creation failed:', completeResult.error);
        }
        
        // Test 7: Test /start again (should show existing ticket)
        console.log('\n🔄 Test 7: /start Again (With Existing Ticket)');
        console.log('---------------------------------------------');
        
        const startAgainResult = await botService.handleStartCommand(testPhoneNumber);
        console.log('✅ Start Again Result:', startAgainResult);
        
        if (startAgainResult.success) {
            console.log('✅ /start command handled successfully (with existing ticket)');
            console.log('📝 Bot Message:', startAgainResult.message);
            console.log('📊 Has Existing Tickets:', startAgainResult.hasExistingTickets);
            console.log('🎫 Open Tickets:', startAgainResult.openTickets.length);
        } else {
            console.log('❌ /start command failed:', startAgainResult.error);
        }
        
        console.log('\n🎉 Bot Flow Test Completed Successfully!');
        console.log('=====================================');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testBotFlow();
