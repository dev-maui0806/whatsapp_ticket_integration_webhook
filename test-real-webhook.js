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

const fs = require('fs');
const path = require('path');

// Load test payloads
const testPayloads = JSON.parse(fs.readFileSync(path.join(__dirname, 'test-payloads.json'), 'utf8'));

const SERVER_URL = 'http://localhost:4000';

async function testRealWebhook(payloadName) {
    const payloads = testPayloads.sampleWebhookPayloads;
    
    if (!payloads[payloadName]) {
        console.log('❌ Available payloads:');
        Object.keys(payloads).forEach(name => console.log(`   - ${name}`));
        return;
    }

    const payload = payloads[payloadName];
    
    console.log(`🧪 Testing REAL WhatsApp webhook with payload: ${payloadName}`);
    console.log('=' .repeat(60));
    console.log('Payload:', JSON.stringify(payload, null, 2));
    console.log('=' .repeat(60));

    try {
        const response = await axios.post(
            `${SERVER_URL}/webhook`,
            payload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log('✅ Webhook test successful!');
        console.log('Status:', response.status);
        console.log('Response:', JSON.stringify(response.data, null, 2));

        // Check if ticket was created/updated
        if (response.data.success) {
            console.log('\n🎫 Checking ticket status...');
            
            const ticketsResponse = await axios.get(`${SERVER_URL}/api/tickets`);
            const tickets = ticketsResponse.data.data || [];
            
            console.log(`Found ${tickets.length} tickets`);
            
            // Find the most recent ticket
            if (tickets.length > 0) {
                const latestTicket = tickets[0];
                console.log('Latest ticket details:');
                console.log(`   ID: ${latestTicket.id}`);
                console.log(`   Ticket Number: ${latestTicket.ticket_number}`);
                console.log(`   Customer ID: ${latestTicket.customer_id}`);
                console.log(`   Status: ${latestTicket.status}`);
                console.log(`   Issue Type: ${latestTicket.issue_type}`);
                console.log(`   Vehicle: ${latestTicket.vehicle_number || 'Not set'}`);
                console.log(`   Driver: ${latestTicket.driver_number || 'Not set'}`);
                console.log(`   Location: ${latestTicket.location || 'Not set'}`);
                console.log(`   Date: ${latestTicket.availability_date || 'Not set'}`);
                console.log(`   Time: ${latestTicket.availability_time || 'Not set'}`);
                console.log(`   Comment: ${latestTicket.comment || 'Not set'}`);
            }
        }

    } catch (error) {
        console.log('❌ Webhook test failed!');
        console.log('Error:', error.message);
        
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
    console.log('Usage: node test-real-webhook.js <payload-name>');
    console.log('\nAvailable payloads:');
    Object.keys(testPayloads.sampleWebhookPayloads).forEach(name => {
        console.log(`   - ${name}`);
    });
    console.log('\nExample: node test-real-webhook.js ticketDetailsMessage');
    process.exit(1);
}

testRealWebhook(payloadName);
