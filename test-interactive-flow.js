const axios = require('axios');
require('dotenv').config();

const BASE_URL = process.env.SERVER_URL || 'http://localhost:3001';
const WEBHOOK_URL = `${BASE_URL}/enhanced-webhook`;

// Test phone number
const TEST_PHONE = '48794740269';

// Simulate WhatsApp webhook payload
function createWebhookPayload(from, text, interactiveId = null) {
    return {
        object: 'whatsapp_business_account',
        entry: [{
            id: '123456789',
            changes: [{
                value: {
                    messaging_product: 'whatsapp',
                    metadata: {
                        display_phone_number: '1234567890',
                        phone_number_id: '123456789'
                    },
                    contacts: [{
                        profile: {
                            name: 'Test Customer'
                        },
                        wa_id: from
                    }],
                    messages: [{
                        id: `msg_${Date.now()}`,
                        from: from,
                        timestamp: Math.floor(Date.now() / 1000),
                        type: interactiveId ? 'interactive' : 'text',
                        text: interactiveId ? null : { body: text },
                        interactive: interactiveId ? {
                            type: 'button_reply',
                            button_reply: {
                                id: interactiveId,
                                title: text
                            }
                        } : null
                    }]
                },
                field: 'messages'
            }]
        }]
    };
}

async function testInteractiveFlow() {
    console.log('🧪 Testing Interactive WhatsApp Bot Flow\n');
    
    try {
        // Step 1: Send initial greeting
        console.log('1️⃣ Sending initial greeting...');
        const greetingPayload = createWebhookPayload(TEST_PHONE, 'hello');
        const greetingResponse = await axios.post(WEBHOOK_URL, greetingPayload);
        console.log('✅ Greeting response:', greetingResponse.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 2: Click START button
        console.log('\n2️⃣ Clicking START button...');
        const startPayload = createWebhookPayload(TEST_PHONE, 'START', 'greeting_start');
        const startResponse = await axios.post(WEBHOOK_URL, startPayload);
        console.log('✅ START response:', startResponse.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 3: Click "Create new ticket" button
        console.log('\n3️⃣ Clicking "Create new ticket" button...');
        const createPayload = createWebhookPayload(TEST_PHONE, 'Create a new ticket', 'start_create');
        const createResponse = await axios.post(WEBHOOK_URL, createPayload);
        console.log('✅ Create ticket response:', createResponse.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 4: Select ticket type from list
        console.log('\n4️⃣ Selecting ticket type from list...');
        const typePayload = createWebhookPayload(TEST_PHONE, 'Lock Open', 'ticket_type_lock_open');
        const typeResponse = await axios.post(WEBHOOK_URL, typePayload);
        console.log('✅ Ticket type response:', typeResponse.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 5: Fill form data
        console.log('\n5️⃣ Sending form data...');
        const formPayload = createWebhookPayload(TEST_PHONE, 'HR55J2345, 9876543210, Delhi Office, Need urgent lock opening');
        const formResponse = await axios.post(WEBHOOK_URL, formPayload);
        console.log('✅ Form data response:', formResponse.status);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Step 6: Submit form
        console.log('\n6️⃣ Submitting form...');
        const submitPayload = createWebhookPayload(TEST_PHONE, 'Submit', 'form_submit');
        const submitResponse = await axios.post(WEBHOOK_URL, submitPayload);
        console.log('✅ Submit response:', submitResponse.status);
        
        console.log('\n🎉 Interactive flow test completed!');
        console.log('\n📱 Check WhatsApp for interactive messages:');
        console.log('   - Welcome message with START button');
        console.log('   - Ticket selection with Create button');
        console.log('   - Ticket type list with all 5 options');
        console.log('   - Form submission with Submit/Re-enter buttons');
        
    } catch (error) {
        console.error('❌ Test failed:', error.response?.data || error.message);
    }
}

// Run the test
testInteractiveFlow();
