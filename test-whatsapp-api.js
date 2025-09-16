const axios = require('axios');

// Set actual WhatsApp API credentials
process.env.WHATSAPP_API_URL = 'https://graph.facebook.com/v17.0';
process.env.WHATSAPP_ACCESS_TOKEN = 'EAATpMvZAJA5oBPEhSNwN7MwG76VVPxTykrClLQnHbpzys4yD2okEHArzhUhdcBrotjm8wZArw5YIk9An6hjUvlCfTXA0ZADh2vIZBASRg9hJiAZAR5ZCRGISmeGKNLjkQ9nM6kDYx1X6k5r8yghPipOIiUKRkCa3gTZAnDxN3atm4h56JSlNCCZBxSeHgZCz6';
process.env.WHATSAPP_PHONE_NUMBER_ID = '639323635919894';
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = '1234';
process.env.WHATSAPP_BUSINESS_ID = '1810065506501128';
process.env.WHATSAPP_CLIENT_ID = '1382304996459418';
process.env.WHATSAPP_CLIENT_SECRET = 'b00075532e43173f82c8611602194760';
process.env.NODE_ENV = 'production';

const WhatsAppService = require('./services/whatsappService');
const TicketService = require('./services/ticketService');

async function testWhatsAppAPI() {
    console.log('🧪 Testing WhatsApp API Integration');
    console.log('=====================================');
    
    const whatsappService = new WhatsAppService();
    const ticketService = new TicketService();
    
    // Test 1: Verify API credentials
    console.log('\n1. Testing API Credentials:');
    console.log(`   API URL: ${process.env.WHATSAPP_API_URL}`);
    console.log(`   Phone Number ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
    console.log(`   Access Token: ${process.env.WHATSAPP_ACCESS_TOKEN.substring(0, 20)}...`);
    
    // Test 2: Test phone number formatting
    console.log('\n2. Testing Phone Number Formatting:');
    const testPhone = '+48794740269';
    const formattedPhone = whatsappService.formatPhoneNumber(testPhone);
    console.log(`   Original: ${testPhone}`);
    console.log(`   Formatted: ${formattedPhone}`);
    
    // Test 3: Test message sending (to a test number)
    console.log('\n3. Testing Message Sending:');
    try {
        const testMessage = 'Hello! This is a test message from the WhatsApp Ticketing System.';
        console.log(`   Sending test message to ${formattedPhone}...`);
        
        const result = await whatsappService.sendMessage(formattedPhone, testMessage);
        
        if (result.success) {
            console.log('   ✅ Message sent successfully!');
            if (result.mocked) {
                console.log('   📝 Note: This was a mocked response (NODE_ENV != production)');
            } else {
                console.log(`   📱 WhatsApp Message ID: ${result.messageId}`);
            }
        } else {
            console.log(`   ❌ Failed to send message: ${result.error}`);
        }
    } catch (error) {
        console.log(`   ❌ Error sending message: ${error.message}`);
    }
    
    // Test 4: Test ticket information parsing
    console.log('\n4. Testing Ticket Information Parsing:');
    const testMessage = 'Vehicle: ABC123, Driver: XYZ789, Location: Warsaw, Date: 2024-01-15, Time: 14:00, Comment: Need lock repair';
    console.log(`   Test message: ${testMessage}`);
    
    const ticketInfo = ticketService.extractTicketInfo(testMessage);
    console.log('   Parsed information:');
    console.log(`   - Vehicle: ${ticketInfo.vehicle_number}`);
    console.log(`   - Driver: ${ticketInfo.driver_number}`);
    console.log(`   - Location: ${ticketInfo.location}`);
    console.log(`   - Date: ${ticketInfo.availability_date}`);
    console.log(`   - Time: ${ticketInfo.availability_time}`);
    console.log(`   - Issue Type: ${ticketInfo.issue_type}`);
    console.log(`   - Comment: ${ticketInfo.comment}`);
    console.log(`   - Complete: ${ticketInfo.isComplete}`);
    
    // Test 5: Test webhook verification
    console.log('\n5. Testing Webhook Verification:');
    const testVerifyToken = '1234';
    const testChallenge = 'test_challenge_123';
    
    const verificationResult = whatsappService.verifyWebhook(testVerifyToken, testChallenge);
    console.log(`   Verify Token: ${testVerifyToken}`);
    console.log(`   Challenge: ${testChallenge}`);
    console.log(`   Verification Result: ${verificationResult}`);
    
    console.log('\n✅ WhatsApp API Integration Test Complete!');
    console.log('=====================================');
}

// Run the test
testWhatsAppAPI().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});
