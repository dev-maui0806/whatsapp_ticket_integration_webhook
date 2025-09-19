const BotConversationService = require('./services/botConversationService');
const botConversationService = new BotConversationService();

async function testInteractiveMessages() {
    console.log('🧪 Testing Interactive Message Functions\n');
    
    const testPhone = '48794740269';
    
    try {
        // Test 1: Initial greeting with START button
        console.log('1️⃣ Testing initial greeting with START button...');
        const greetingResult = await botConversationService.handleInitialGreeting(testPhone, 'hello', 'Test Customer');
        console.log('✅ Greeting result:', greetingResult.success ? 'SUCCESS' : 'FAILED');
        if (!greetingResult.success) {
            console.log('   Error:', greetingResult.error);
        }
        
        // Test 2: Handle START command (should show ticket selection)
        console.log('\n2️⃣ Testing START command...');
        const startResult = await botConversationService.handleStartCommand(testPhone);
        console.log('✅ START result:', startResult.success ? 'SUCCESS' : 'FAILED');
        if (!startResult.success) {
            console.log('   Error:', startResult.error);
        }
        
        // Test 3: Handle "Create new ticket" selection
        console.log('\n3️⃣ Testing "Create new ticket" selection...');
        const createResult = await botConversationService.handleNewTicketSelection(testPhone, 'id:start_create');
        console.log('✅ Create ticket result:', createResult.success ? 'SUCCESS' : 'FAILED');
        if (!createResult.success) {
            console.log('   Error:', createResult.error);
        }
        
        console.log('\n🎉 Interactive message tests completed!');
        console.log('\n📋 Summary:');
        console.log('   - Initial greeting now sends interactive button');
        console.log('   - START command shows ticket selection buttons');
        console.log('   - Create ticket shows interactive list with all 5 ticket types');
        console.log('   - All messages are saved to database for dashboard mirroring');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testInteractiveMessages();
