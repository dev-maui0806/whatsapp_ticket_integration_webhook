const axios = require('axios');
require('dotenv').config();

class MockWhatsAppService {
    constructor() {
        this.apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || 'test_access_token_12345';
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '48794740269';
        this.verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'test_verify_token_12345';
        this.isMockMode = true; // Enable mock mode for testing
    }

    // Mock send message - logs instead of actually sending
    async sendMessage(phoneNumber, message) {
        console.log('📱 [MOCK] WhatsApp Message:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   Message: ${message}`);
        console.log(`   Timestamp: ${new Date().toISOString()}`);
        
        // Simulate API response
        const mockResponse = {
            success: true,
            messageId: `mock_${Date.now()}`,
            data: {
                messaging_product: "whatsapp",
                contacts: [{
                    input: phoneNumber,
                    wa_id: phoneNumber.replace('+', '')
                }],
                messages: [{
                    id: `mock_${Date.now()}`
                }]
            }
        };

        return mockResponse;
    }

    // Mock send template message
    async sendTemplateMessage(phoneNumber, templateName, languageCode = 'en_US', components = []) {
        console.log('📱 [MOCK] WhatsApp Template Message:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   Template: ${templateName}`);
        console.log(`   Language: ${languageCode}`);
        console.log(`   Components: ${JSON.stringify(components)}`);
        
        return {
            success: true,
            messageId: `mock_template_${Date.now()}`,
            data: {
                messaging_product: "whatsapp",
                contacts: [{
                    input: phoneNumber,
                    wa_id: phoneNumber.replace('+', '')
                }],
                messages: [{
                    id: `mock_template_${Date.now()}`
                }]
            }
        };
    }

    // Mock send interactive message
    async sendInteractiveMessage(phoneNumber, headerText, bodyText, footerText, buttons) {
        console.log('📱 [MOCK] WhatsApp Interactive Message:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   Header: ${headerText}`);
        console.log(`   Body: ${bodyText}`);
        console.log(`   Footer: ${footerText}`);
        console.log(`   Buttons: ${JSON.stringify(buttons)}`);
        
        return {
            success: true,
            messageId: `mock_interactive_${Date.now()}`,
            data: {
                messaging_product: "whatsapp",
                contacts: [{
                    input: phoneNumber,
                    wa_id: phoneNumber.replace('+', '')
                }],
                messages: [{
                    id: `mock_interactive_${Date.now()}`
                }]
            }
        };
    }

    // Mock send list message
    async sendListMessage(phoneNumber, headerText, bodyText, footerText, buttonText, sections) {
        console.log('📱 [MOCK] WhatsApp List Message:');
        console.log(`   To: ${phoneNumber}`);
        console.log(`   Header: ${headerText}`);
        console.log(`   Body: ${bodyText}`);
        console.log(`   Footer: ${footerText}`);
        console.log(`   Button: ${buttonText}`);
        console.log(`   Sections: ${JSON.stringify(sections)}`);
        
        return {
            success: true,
            messageId: `mock_list_${Date.now()}`,
            data: {
                messaging_product: "whatsapp",
                contacts: [{
                    input: phoneNumber,
                    wa_id: phoneNumber.replace('+', '')
                }],
                messages: [{
                    id: `mock_list_${Date.now()}`
                }]
            }
        };
    }

    // Verify webhook (same as real implementation)
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            return challenge;
        }
        return null;
    }

    // Process incoming webhook (same as real implementation)
    processWebhook(webhookData) {
        try {
            const entry = webhookData.entry[0];
            const changes = entry.changes[0];
            const value = changes.value;

            if (value.messages) {
                return value.messages.map(message => ({
                    id: message.id,
                    from: message.from,
                    timestamp: message.timestamp,
                    type: message.type,
                    text: message.text?.body || '',
                    image: message.image,
                    document: message.document,
                    audio: message.audio,
                    video: message.video,
                    location: message.location,
                    contacts: message.contacts,
                    context: message.context,
                    interactive: message.interactive
                }));
            }

            if (value.statuses) {
                return value.statuses.map(status => ({
                    id: status.id,
                    status: status.status,
                    timestamp: status.timestamp,
                    recipient_id: status.recipient_id,
                    conversation: status.conversation,
                    pricing: status.pricing
                }));
            }

            return [];
        } catch (error) {
            console.error('Webhook processing error:', error);
            return [];
        }
    }

    // Format phone number for WhatsApp API
    formatPhoneNumber(phoneNumber) {
        // Remove all non-digit characters
        let cleaned = phoneNumber.replace(/\D/g, '');
        
        // Add country code if not present (assuming Poland +48)
        if (cleaned.length === 9 && cleaned.startsWith('79')) {
            cleaned = '48' + cleaned;
        }
        
        return cleaned;
    }

    // Test method to verify service is working
    async testConnection() {
        console.log('🧪 Testing Mock WhatsApp Service...');
        console.log(`   API URL: ${this.apiUrl}`);
        console.log(`   Phone Number ID: ${this.phoneNumberId}`);
        console.log(`   Verify Token: ${this.verifyToken}`);
        console.log(`   Mock Mode: ${this.isMockMode ? 'ENABLED' : 'DISABLED'}`);
        
        return {
            success: true,
            message: 'Mock WhatsApp service is ready for testing',
            config: {
                apiUrl: this.apiUrl,
                phoneNumberId: this.phoneNumberId,
                verifyToken: this.verifyToken,
                mockMode: this.isMockMode
            }
        };
    }
}

module.exports = MockWhatsAppService;

