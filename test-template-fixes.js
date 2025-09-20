const BotConversationService = require('./services/botConversationService');
const botConversationService = new BotConversationService();

async function testTemplateFixes() {
    console.log('🧪 Testing Template Message Fixes\n');
    
    try {
        const testPhone = '48794740269';
        
        // Test 1: Template message with proper payload structure
        console.log('1️⃣ Testing template message payload structure...');
        const typeSelectionResult = await botConversationService.handleTicketTypeSelection(testPhone, 'id:ticket_type_lock_open');
        
        if (typeSelectionResult.success) {
            console.log('✅ Template message handling successful');
            console.log('   Ticket Type:', typeSelectionResult.ticketType);
            console.log('   Template Name:', typeSelectionResult.templateName);
            console.log('   Interactive Sent:', typeSelectionResult.interactiveSent);
            console.log('   Fallback Used:', typeSelectionResult.fallback || false);
            console.log('   Message:', typeSelectionResult.message);
        } else {
            console.log('❌ Template message handling failed:', typeSelectionResult.error);
        }
        
        console.log('\n🎉 Template fixes test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testTemplateFixes();
