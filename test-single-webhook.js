const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load test payloads
const testPayloads = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-payloads.json'), 'utf8'));

const SERVER_URL = 'http://localhost:4000';

async function testSingleWebhook(payloadName) {
    const payloads = testPayloads.sampleWebhookPayloads;
    
    if (!payloads[payloadName]) {
        console.log('❌ Available payloads:');
        Object.keys(payloads).forEach(name => console.log(`   - ${name}`));
        return;
    }

    const payload = payloads[payloadName];
    
    console.log(`🧪 Testing webhook with payload: ${payloadName}`);
    console.log('=' .repeat(50));
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('=' .repeat(50));

    try {
        const response = await axios.post(
            `${SERVER_URL}/webhook`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            }
        );

        console.log('✅ Webhook test successful!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        // Check if ticket was created
        if (response.data.success) {
            console.log('\n🎫 Checking if ticket was created...');
            
            const ticketsResponse = await axios.get(`${SERVER_URL}/api/tickets`);
            const tickets = ticketsResponse.data.data || [];
            
            console.log(`Found ${tickets.length} tickets`);
            
            // Find the most recent ticket
            if (tickets.length > 0) {
                const latestTicket = tickets[0];
                console.log('Latest ticket:', {
                    id: latestTicket.id,
                    ticket_number: latestTicket.ticket_number,
                    phone_number: latestTicket.phone_number,
                    status: latestTicket.status,
                    issue_type: latestTicket.issue_type
                });
            }
        }

    } catch (error) {
        console.log('❌ Webhook test failed!');
        console.log('Error:', error.message);
        console.log('Full error:', error);
        
        if (error.response) {
            console.log('Status:', error.response.status);
            console.log('Response:', JSON.stringify(error.response.data, null, 2));
        }
        
        if (error.code) {
            console.log('Error code:', error.code);
        }
    }
}

// Get payload name from command line arguments
const payloadName = process.argv[2];

if (!payloadName) {
    console.log('Usage: node test-single-webhook.js <payload-name>');
    console.log('\nAvailable payloads:');
    Object.keys(testPayloads.sampleWebhookPayloads).forEach(name => {
        console.log(`   - ${name}`);
    });
    console.log('\nExample: node test-single-webhook.js newCustomerMessage');
    process.exit(1);
}

testSingleWebhook(payloadName);

