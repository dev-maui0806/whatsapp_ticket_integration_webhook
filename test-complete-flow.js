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

async function testCompleteFlow() {
    console.log('🧪 Testing Complete WhatsApp Integration Flow');
    console.log('==============================================');
    
    const SERVER_URL = 'http://localhost:4000';
    
    // Test payload with complete ticket details
    const testPayload = {
        "object": "whatsapp_business_account",
        "entry": [
            {
                "id": "123456789",
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {
                                "display_phone_number": "+48794740269",
                                "phone_number_id": "639323635919894"
                            },
                            "messages": [
                                {
                                    "id": "wamid.test123456789",
                                    "from": "48794740269",
                                    "timestamp": "1640995400",
                                    "text": {
                                        "body": "Vehicle: ABC123, Driver: XYZ789, Location: Warsaw, Date: 2024-01-15, Time: 14:00, Comment: Need lock repair"
                                    },
                                    "type": "text"
                                }
                            ]
                        },
                        "field": "messages"
                    }
                ]
            }
        ]
    };
    
    console.log('\n1. Sending webhook with complete ticket details...');
    console.log('   Message: "Vehicle: ABC123, Driver: XYZ789, Location: Warsaw, Date: 2024-01-15, Time: 14:00, Comment: Need lock repair"');
    
    try {
        const response = await axios.post(
            `${SERVER_URL}/webhook`,
            testPayload,
            {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );

        console.log('   ✅ Webhook processed successfully!');
        console.log(`   Status: ${response.status}`);
        
        // Check tickets
        console.log('\n2. Checking created/updated tickets...');
        const ticketsResponse = await axios.get(`${SERVER_URL}/api/tickets`);
        const tickets = ticketsResponse.data.data || [];
        
        console.log(`   Found ${tickets.length} total tickets`);
        
        // Find ticket for our test customer
        const testTicket = tickets.find(t => t.phone_number === '48794740269');
        
        if (testTicket) {
            console.log('   ✅ Found ticket for test customer!');
            console.log('   Ticket Details:');
            console.log(`   - ID: ${testTicket.id}`);
            console.log(`   - Ticket Number: ${testTicket.ticket_number}`);
            console.log(`   - Status: ${testTicket.status}`);
            console.log(`   - Issue Type: ${testTicket.issue_type}`);
            console.log(`   - Vehicle: ${testTicket.vehicle_number || 'Not set'}`);
            console.log(`   - Driver: ${testTicket.driver_number || 'Not set'}`);
            console.log(`   - Location: ${testTicket.location || 'Not set'}`);
            console.log(`   - Date: ${testTicket.availability_date || 'Not set'}`);
            console.log(`   - Time: ${testTicket.availability_time || 'Not set'}`);
            console.log(`   - Comment: ${testTicket.comment || 'Not set'}`);
            
            // Verify parsing worked
            const parsingWorked = testTicket.vehicle_number === 'ABC123' && 
                                testTicket.driver_number === 'XYZ789' && 
                                testTicket.location === 'Warsaw';
            
            if (parsingWorked) {
                console.log('\n   🎉 SUCCESS: Ticket details were parsed and stored correctly!');
            } else {
                console.log('\n   ⚠️  WARNING: Ticket details were not parsed correctly');
            }
        } else {
            console.log('   ❌ No ticket found for test customer');
        }
        
    } catch (error) {
        console.log('   ❌ Test failed:', error.message);
        if (error.response) {
            console.log('   Response:', JSON.stringify(error.response.data, null, 2));
        }
    }
    
    console.log('\n✅ Complete Flow Test Finished');
    console.log('==============================================');
}

testCompleteFlow().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
});