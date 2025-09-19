const BotConversationService = require('./services/botConversationService');
const WhatsAppService = require('./services/whatsappService');
const { executeQuery } = require('./config/database');

async function testCompleteFlow() {
    console.log('🧪 Testing Complete Bot Flow...');
    console.log('=====================================');
    
    const botService = new BotConversationService();
    const whatsappService = new WhatsAppService();
    const testPhoneNumber = '918826000390';
    
    try {
        // Test 1: Initial greeting
        console.log('\n📱 Test 1: Initial Greeting');
        console.log('----------------------------');
        
        const greetingResult = await botService.handleInitialGreeting(testPhoneNumber, 'HELLO', 'Test Customer');
        console.log('✅ Greeting Result:', greetingResult);
        
        if (greetingResult.success) {
            console.log('✅ Initial greeting handled successfully');
            if (greetingResult.message) {
                console.log('📝 Bot Message:', greetingResult.message);
            } else {
                console.log('📝 No message sent (customer already received greeting)');
            }
        } else {
            console.log('❌ Initial greeting failed:', greetingResult.error);
        }
        
        // Test 2: /start command
        console.log('\n🚀 Test 2: /start Command');
        console.log('-------------------------');
        
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
        
        // Test 7: Check database messages
        console.log('\n📊 Test 7: Check Database Messages');
        console.log('----------------------------------');
        
        const messagesResult = await executeQuery(`
            SELECT id, phone_number, sender_type, message_text, created_at 
            FROM messages 
            WHERE phone_number = ? 
            ORDER BY created_at ASC
        `, [testPhoneNumber]);
        
        if (messagesResult.success) {
            console.log('✅ Database messages retrieved successfully');
            console.log('📝 Total messages:', messagesResult.data.length);
            messagesResult.data.forEach((msg, index) => {
                console.log(`  ${index + 1}. [${msg.sender_type}] ${msg.message_text.substring(0, 50)}...`);
            });
            } else {
            console.log('❌ Failed to retrieve database messages:', messagesResult.error);
        }
        
        // Test 8: Check customer record
        console.log('\n👤 Test 8: Check Customer Record');
        console.log('-------------------------------');
        
        const customerResult = await executeQuery(`
            SELECT id, phone_number, name, created_at 
            FROM customers 
            WHERE phone_number = ?
        `, [testPhoneNumber]);
        
        if (customerResult.success && customerResult.data.length > 0) {
            console.log('✅ Customer record found');
            const customer = customerResult.data[0];
            console.log('📝 Customer:', customer);
        } else {
            console.log('❌ Customer record not found');
        }
        
        console.log('\n🎉 Complete Flow Test Completed Successfully!');
        console.log('=============================================');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

// Run the test
testCompleteFlow();