const BotConversationService = require('./services/botConversationService');
const botConversationService = new BotConversationService();

async function testTemplateMessages() {
    console.log('🧪 Testing Template Message Implementation\n');
    
    try {
        const testPhone = '48794740269';
        
        // Test 1: Ticket type selection with template messages
        console.log('1️⃣ Testing ticket type selection with template messages...');
        const typeSelectionResult = await botConversationService.handleTicketTypeSelection(testPhone, '1'); // Select "Unlock"
        
        if (typeSelectionResult.success) {
            console.log('✅ Ticket type selection successful');
            console.log('   Ticket Type:', typeSelectionResult.ticketType);
            console.log('   Template Name:', typeSelectionResult.templateName);
            console.log('   Interactive Sent:', typeSelectionResult.interactiveSent);
            console.log('   Message:', typeSelectionResult.message);
        } else {
            console.log('❌ Ticket type selection failed:', typeSelectionResult.error);
        }
        
        console.log('\n2️⃣ Testing template form completion...');
        const formData = {
            vehicle_number: 'Test Vehicle 123',
            driver_number: 'Test Driver 456',
            location: 'Test Location',
            comment: 'Test Comment'
        };
        
        const completionResult = await botConversationService.handleTemplateFormCompletion(
            testPhone,
            formData,
            'lock_open'
        );
        
        if (completionResult.success) {
            console.log('✅ Template form completion successful');
            console.log('   Action:', completionResult.action);
            console.log('   Ticket Number:', completionResult.ticketNumber);
            console.log('   Message:', completionResult.message);
            console.log('   WhatsApp Sent:', completionResult.whatsappSent);
        } else {
            console.log('❌ Template form completion failed:', completionResult.error);
        }
        
        console.log('\n🎉 Template message test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testTemplateMessages();
