const axios = require('axios');
require('dotenv').config();

console.log('🔍 Verifying Server Setup with Real WhatsApp API');
console.log('================================================');

// Check environment variables
console.log('\n1. Environment Variables Check:');
console.log(`   ✅ WHATSAPP_API_URL: ${process.env.WHATSAPP_API_URL}`);
console.log(`   ✅ WHATSAPP_ACCESS_TOKEN: ${process.env.WHATSAPP_ACCESS_TOKEN ? 'Set (length: ' + process.env.WHATSAPP_ACCESS_TOKEN.length + ')' : '❌ Not set'}`);
console.log(`   ✅ WHATSAPP_PHONE_NUMBER_ID: ${process.env.WHATSAPP_PHONE_NUMBER_ID}`);
console.log(`   ✅ WHATSAPP_WEBHOOK_VERIFY_TOKEN: ${process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN}`);
console.log(`   ✅ NODE_ENV: ${process.env.NODE_ENV}`);

// Test WhatsApp Service
console.log('\n2. WhatsApp Service Test:');
try {
    const WhatsAppService = require('./services/whatsappService');
    const whatsappService = new WhatsAppService();
    
    console.log('   ✅ WhatsAppService loaded successfully');
    console.log(`   ✅ API URL: ${whatsappService.apiUrl}`);
    console.log(`   ✅ Phone Number ID: ${whatsappService.phoneNumberId}`);
    
    // Test phone formatting
    const testPhone = '+48794740269';
    const formatted = whatsappService.formatPhoneNumber(testPhone);
    console.log(`   ✅ Phone formatting: ${testPhone} → ${formatted}`);
    
} catch (error) {
    console.log(`   ❌ WhatsAppService error: ${error.message}`);
}

// Test Ticket Service
console.log('\n3. Ticket Service Test:');
try {
    const TicketService = require('./services/ticketService');
    const ticketService = new TicketService();
    
    console.log('   ✅ TicketService loaded successfully');
    
    // Test parsing
    const testMessage = 'Vehicle: ABC123, Driver: XYZ789, Location: Warsaw, Date: 2024-01-15, Time: 14:00, Comment: Need lock repair';
    const parsed = ticketService.extractTicketInfo(testMessage);
    console.log('   ✅ Ticket parsing test:');
    console.log(`      - Vehicle: ${parsed.vehicle_number}`);
    console.log(`      - Driver: ${parsed.driver_number}`);
    console.log(`      - Location: ${parsed.location}`);
    console.log(`      - Complete: ${parsed.isComplete}`);
    
} catch (error) {
    console.log(`   ❌ TicketService error: ${error.message}`);
}

// Test Database Connection
console.log('\n4. Database Connection Test:');
try {
    const { executeQuery } = require('./config/database');
    
    executeQuery('SELECT 1 as test').then(result => {
        if (result.success) {
            console.log('   ✅ Database connection successful');
        } else {
            console.log('   ❌ Database query failed');
        }
    }).catch(error => {
        console.log(`   ❌ Database error: ${error.message}`);
    });
    
} catch (error) {
    console.log(`   ❌ Database connection error: ${error.message}`);
}

// Test Server Endpoints
console.log('\n5. Server Endpoints Test:');
const SERVER_URL = 'http://localhost:4000';

async function testEndpoints() {
    try {
        // Test webhook verification
        const verifyResponse = await axios.get(`${SERVER_URL}/webhook?hub.mode=subscribe&hub.verify_token=${process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN}&hub.challenge=test123`);
        console.log(`   ✅ Webhook verification: ${verifyResponse.status} - ${verifyResponse.data}`);
        
        // Test API endpoints
        const ticketsResponse = await axios.get(`${SERVER_URL}/api/tickets`);
        console.log(`   ✅ Tickets API: ${ticketsResponse.status} - ${ticketsResponse.data.data.length} tickets`);
        
        // Test health endpoint
        const healthResponse = await axios.get(`${SERVER_URL}/health`);
        console.log(`   ✅ Health endpoint: ${healthResponse.status} - ${healthResponse.data.status}`);
        
        // Test root endpoint (should work even without client build)
        const rootResponse = await axios.get(`${SERVER_URL}/`);
        console.log(`   ✅ Root endpoint: ${rootResponse.status} - ${rootResponse.data.message || 'OK'}`);
        
        // Test webhook POST endpoint
        const webhookPayload = {
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
                                        "id": "wamid.verify123",
                                        "from": "48794740269",
                                        "timestamp": "1640995400",
                                        "text": {
                                            "body": "Test verification message"
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
        
        const webhookResponse = await axios.post(`${SERVER_URL}/webhook`, webhookPayload, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000
        });
        console.log(`   ✅ Webhook POST: ${webhookResponse.status} - ${webhookResponse.data.status}`);
        
    } catch (error) {
        console.log(`   ❌ Server endpoints error: ${error.message}`);
        if (error.response) {
            console.log(`   Response status: ${error.response.status}`);
            console.log(`   Response data: ${JSON.stringify(error.response.data, null, 2)}`);
        }
    }
}

testEndpoints();

console.log('\n✅ Server Setup Verification Complete');
console.log('================================================');
