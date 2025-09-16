const axios = require('axios');
require('dotenv').config();

async function debugWebhook() {
    console.log('🔍 Debugging Webhook Endpoint');
    console.log('==============================');
    
    const SERVER_URL = 'http://localhost:4000';
    
    // Simple test payload
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
                                    "id": "wamid.debug123",
                                    "from": "48794740269",
                                    "timestamp": "1640995400",
                                    "text": {
                                        "body": "Hello, I need help"
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
    
    try {
        console.log('Sending test webhook payload...');
        console.log('Payload:', JSON.stringify(testPayload, null, 2));
        
        const response = await axios.post(
            `${SERVER_URL}/webhook`,
            testPayload,
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
        
        // Log the full error for debugging
        console.log('Full error object:', error);
    }
}

debugWebhook().catch(error => {
    console.error('❌ Debug failed:', error.message);
    process.exit(1);
});
