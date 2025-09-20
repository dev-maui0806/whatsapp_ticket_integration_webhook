const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:4000';
const CUSTOMER_API_URL = `${BASE_URL}/api/customers`;

// Test phone number
const TEST_PHONE = '48794740269';

async function testAgentToWhatsApp() {
    console.log('🧪 Testing Agent to WhatsApp Message Flow\n');
    
    try {
        // Step 1: Send message from agent to customer via API
        console.log('1️⃣ Sending message from agent to customer...');
        const messageData = {
            message: 'Hello! This is a test message from the agent dashboard. How can I help you today?',
            agent_id: 1
        };
        
        const response = await axios.post(`${CUSTOMER_API_URL}/${TEST_PHONE}/message`, messageData);
        
        if (response.data.success) {
            console.log('✅ Message sent successfully via API');
            console.log('   Message ID:', response.data.data.id);
            console.log('   Message Text:', response.data.data.message_text);
            console.log('   Sender Type:', response.data.data.sender_type);
            console.log('   Phone Number:', response.data.data.phone_number);
        } else {
            console.log('❌ Failed to send message:', response.data.error);
            return;
        }
        
        // Step 2: Verify message was saved to database
        console.log('\n2️⃣ Verifying message in database...');
        const messagesResponse = await axios.get(`${CUSTOMER_API_URL}/${TEST_PHONE}/messages`);
        
        if (messagesResponse.data.success) {
            const messages = messagesResponse.data.data;
            console.log(`✅ Found ${messages.length} messages in database`);
            
            // Find the latest agent message
            const agentMessages = messages.filter(msg => msg.sender_type === 'agent');
            if (agentMessages.length > 0) {
                const latestAgentMessage = agentMessages[agentMessages.length - 1];
                console.log('   Latest agent message:', latestAgentMessage.message_text);
                console.log('   Created at:', latestAgentMessage.created_at);
            }
        } else {
            console.log('❌ Failed to fetch messages from database');
        }
        
        // Step 3: Check WhatsApp service configuration
        console.log('\n3️⃣ Checking WhatsApp service configuration...');
        console.log('   WhatsApp API URL:', process.env.WHATSAPP_API_URL || 'Not set');
        console.log('   WhatsApp Access Token:', process.env.WHATSAPP_ACCESS_TOKEN ? 'Set' : 'Not set');
        console.log('   WhatsApp Phone Number ID:', process.env.WHATSAPP_PHONE_NUMBER_ID || 'Not set');
        
        console.log('\n🎉 Agent to WhatsApp message flow test completed!');
        console.log('\n📋 Expected behavior:');
        console.log('   - Message should be saved to database with sender_type="agent"');
        console.log('   - Message should be sent to WhatsApp via API');
        console.log('   - Message should appear on customer\'s WhatsApp');
        console.log('   - Message should appear on dashboard chat interface');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testAgentToWhatsApp();
