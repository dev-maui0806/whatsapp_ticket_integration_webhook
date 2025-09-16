const axios = require('axios');
require('dotenv').config();

async function testAgentReply() {
    console.log('🧪 Testing Agent Reply Functionality');
    console.log('=====================================');
    
    const SERVER_URL = 'http://localhost:4000';
    
    // First, let's check what tickets exist
    console.log('\n1. Checking existing tickets...');
    try {
        const ticketsResponse = await axios.get(`${SERVER_URL}/api/tickets`);
        const tickets = ticketsResponse.data.data || [];
        
        console.log(`Found ${tickets.length} tickets`);
        
        if (tickets.length === 0) {
            console.log('❌ No tickets found. Please create a ticket first by sending a WhatsApp message.');
            return;
        }
        
        // Use the first ticket
        const ticket = tickets[0];
        console.log(`Using ticket: ID ${ticket.id}, Customer: ${ticket.phone_number}, Status: ${ticket.status}`);
        
        // Test agent reply
        console.log('\n2. Testing agent reply...');
        const agentReplyData = {
            agent_id: 1, // Use the first agent
            message: 'Hello! Thank you for contacting us. How can I help you today?'
        };
        
        console.log(`Sending reply from agent ${agentReplyData.agent_id} to ticket ${ticket.id}`);
        
        const replyResponse = await axios.post(
            `${SERVER_URL}/api/tickets/${ticket.id}/reply`,
            agentReplyData,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        
        console.log('✅ Agent reply sent successfully!');
        console.log('Response:', JSON.stringify(replyResponse.data, null, 2));
        
        // Check if the message was added to the ticket
        console.log('\n3. Checking ticket messages...');
        const messagesResponse = await axios.get(`${SERVER_URL}/api/tickets/${ticket.id}/messages`);
        const messages = messagesResponse.data.data || [];
        
        console.log(`Found ${messages.length} messages in ticket`);
        messages.forEach((msg, i) => {
            console.log(`${i+1}. ${msg.sender_type}: ${msg.message_text} (${msg.created_at})`);
        });
        
    } catch (error) {
        console.log('❌ Test failed:', error.message);
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
}

testAgentReply().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});
