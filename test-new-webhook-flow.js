const axios = require('axios');

// Test the new webhook conversation flow
async function testWebhookFlow() {
    const baseUrl = 'http://localhost:4000';
    const testPhoneNumber = '48794740269'; // Replace with your test number
    
    console.log('🧪 Testing New Webhook Conversation Flow\n');
    
    // Test 1: First message from new customer
    console.log('Test 1: First message from new customer');
    try {
        const response = await axios.post(`${baseUrl}/webhook`, {
            object: 'whatsapp_business_account',
            entry: [{
                id: '123456789',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '1234567890',
                            phone_number_id: '1810065506501128'
                        },
                        messages: [{
                            id: 'wamid.test1',
                            from: testPhoneNumber,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            text: { body: 'Hello, I need help' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        });
        
        console.log('✅ Response:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 2: Ticket type selection
    console.log('Test 2: Ticket type selection');
    try {
        const response = await axios.post(`${baseUrl}/webhook`, {
            object: 'whatsapp_business_account',
            entry: [{
                id: '123456789',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '1234567890',
                            phone_number_id: '1810065506501128'
                        },
                        messages: [{
                            id: 'wamid.test2',
                            from: testPhoneNumber,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            text: { body: 'unlock' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        });
        
        console.log('✅ Response:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 3: Form field input
    console.log('Test 3: Form field input (vehicle number)');
    try {
        const response = await axios.post(`${baseUrl}/webhook`, {
            object: 'whatsapp_business_account',
            entry: [{
                id: '123456789',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '1234567890',
                            phone_number_id: '1810065506501128'
                        },
                        messages: [{
                            id: 'wamid.test3',
                            from: testPhoneNumber,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            text: { body: 'ABC123' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        });
        
        console.log('✅ Response:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
    
    // Test 4: Close conversation
    console.log('Test 4: Close conversation');
    try {
        const response = await axios.post(`${baseUrl}/webhook`, {
            object: 'whatsapp_business_account',
            entry: [{
                id: '123456789',
                changes: [{
                    value: {
                        messaging_product: 'whatsapp',
                        metadata: {
                            display_phone_number: '1234567890',
                            phone_number_id: '1810065506501128'
                        },
                        messages: [{
                            id: 'wamid.test4',
                            from: testPhoneNumber,
                            timestamp: Math.floor(Date.now() / 1000).toString(),
                            text: { body: '/close' },
                            type: 'text'
                        }]
                    },
                    field: 'messages'
                }]
            }]
        });
        
        console.log('✅ Response:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
    
    console.log('\n🎉 Webhook flow testing completed!');
}

// Run the test
if (require.main === module) {
    testWebhookFlow().catch(console.error);
}

module.exports = { testWebhookFlow };
