const BotConversationService = require('./services/botConversationService');
const botConversationService = new BotConversationService();

async function testBotInteractive() {
    console.log('🧪 Testing Bot Interactive List Flow\n');
    
    try {
        const testPhone = '48794740269';
        
        // Test the handleNewTicketSelection method which should send interactive list
        console.log('1️⃣ Testing handleNewTicketSelection...');
        const result = await botConversationService.handleNewTicketSelection(testPhone, 'id:start_create');
        
        if (result.success) {
            console.log('✅ handleNewTicketSelection successful');
            console.log('   Action:', result.action);
            console.log('   Interactive Sent:', result.interactiveSent);
            console.log('   Message:', result.message);
        } else {
            console.log('❌ handleNewTicketSelection failed:', result.error);
        }
        
        console.log('\n🎉 Bot interactive test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testBotInteractive();
