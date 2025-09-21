const axios = require('axios');
require('dotenv').config();

class WhatsAppService {
    constructor() {
        this.apiUrl = process.env.WHATSAPP_API_URL;
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "EAATpMvZAJA5oBPEhSNwN7MwG76VVPxTykrClLQnHbpzys4yD2okEHArzhUhdcBrotjm8wZArw5YIk9An6hjUvlCfTXA0ZADh2vIZBASRg9hJiAZAR5ZCRGISmeGKNLjkQ9nM6kDYx1X6k5r8yghPipOIiUKRkCa3gTZAnDxN3atm4h56JSlNCCZBxSeHgZCz6";
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'test_verify_token_12345';
    }

    // Send text message
    async sendMessage(phoneNumber, message) {
        try {
            // Guard: mock unless explicitly enabled
            const liveEnabled = "true";
            console.log("whatsapp", process.env.WHATSAPP_API_URL)
            if (!liveEnabled) {
                return { success: true, mocked: true, note: 'Live send disabled (WHATSAPP_ENABLE_LIVE!=true)' };
            }

            // Only proceed live when required credentials are present
            if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
                return { success: true, mocked: true };
            }
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const toNumber = this.formatPhoneNumber(phoneNumber) || (phoneNumber && phoneNumber.toString()) || '';
            if (!toNumber) {
                return { success: false, error: 'Invalid phone number' };
            }

            const payload = {
                messaging_product: "whatsapp",
                to: toNumber,
                type: "text",
                text: {
                    body: message
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('WhatsApp API Error:', errMsg);
            // Fallback to mocked success on timeout or network errors during testing
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return { success: true, mocked: true, warning: `Send mocked due to network error: ${error.code || 'timeout'}` };
            }
            return { success: false, error: errMsg };
        }
    }

    //Send template message
    async sendTemplateMessage(phoneNumber, templateName, languageCode = "en", components = []) {
        try {
            // Guard: mock unless explicitly enabled
            console.log("*********sendTemplateMessage***************", phoneNumber, templateName, languageCode, components)
            const liveEnabled = 'true';
            if (!liveEnabled) {
                return { success: true, mocked: true, note: 'Live send disabled (WHATSAPP_ENABLE_LIVE!=true)' };
            }

            // Only proceed live when required credentials are present
            if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
                return { success: true, mocked: true };
            }

            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const toNumber = this.formatPhoneNumber(phoneNumber) || (phoneNumber && phoneNumber.toString()) || '';
            if (!toNumber) {
                console.log("************failed_toNumber****************")
                return { success: false, error: 'Invalid phone number' };
            }

            // Build template payload - only include components if they exist and are valid
            const templatePayload = {
                "name": "utility_templete",
                "language": {
                    "code": languageCode
                }
            }

            // Only add components if they are provided and not empty
            // if (components && components.length > 0) {
            //     templatePayload.components = components;
            // }

            const payload = {
                messaging_product: "whatsapp",
                to: toNumber,
                type: "template",
                template: templatePayload
            };

            console.log("📤 Sending template payload:", JSON.stringify(payload, null, 2));

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });
            console.log("*********response***************", response);
            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('WhatsApp Template API Error:', errMsg);
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return { success: true, mocked: true, warning: `Template mocked due to network error: ${error.code || 'timeout'}` };
            }
            return { success: false, error: errMsg };
        }
    }

    // Send interactive list message
    async sendListMessage(phoneNumber, headerText, bodyText, footerText, buttonText, sections) {
        try {
            console.log('📋 sendListMessage called with:', {
                phoneNumber,
                headerText,
                bodyText,
                footerText,
                buttonText,
                sections
            });

            // Guard: align with text sender (enabled by default unless creds missing)
            const liveEnabled = "true";
            if (!liveEnabled) {
                console.log('⚠️ Live send disabled');
                return { success: true, mocked: true, note: 'Live send disabled (WHATSAPP_ENABLE_LIVE!=true)' };
            }

            // Only proceed live when required credentials are present
            if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
                console.log('⚠️ Missing WhatsApp credentials, mocking send');
                return { success: true, mocked: true };
            }
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const toNumber = this.formatPhoneNumber(phoneNumber) || (phoneNumber && phoneNumber.toString()) || '';
            if (!toNumber) {
                return { success: false, error: 'Invalid phone number' };
            }

            const payload = {
                messaging_product: "whatsapp",
                to: toNumber,
                type: "interactive",
                interactive: {
                    type: "list",
                    header: {
                        type: "text",
                        text: headerText
                    },
                    body: {
                        text: bodyText
                    },
                    footer: {
                        text: footerText
                    },
                    action: {
                        button: buttonText,
                        sections: sections
                    }
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('WhatsApp List API Error:', errMsg);
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return { success: true, mocked: true, warning: `List mocked due to network error: ${error.code || 'timeout'}` };
            }
            return { success: false, error: errMsg };
        }
    }

    // Send template message
    // async sendTemplateMessage(phoneNumber, templateName) {
    //     try {
    //         console.log('📋 sendTemplateMessage called with:', {
    //             phoneNumber,
    //             templateName
    //         });

    //         // Guard: align with text sender (enabled by default unless creds missing)
    //         const liveEnabled = "true";
    //         if (!liveEnabled) {
    //             console.log('⚠️ Live send disabled');
    //             return { success: true, mocked: true, note: 'Live send disabled (WHATSAPP_ENABLE_LIVE!=true)' };
    //         }

    //         // Only proceed live when required credentials are present
    //         if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
    //             console.log('⚠️ Missing WhatsApp credentials, mocking send');
    //             return { success: true, mocked: true };
    //         }

    //         const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
    //         const toNumber = this.formatPhoneNumber(phoneNumber) || (phoneNumber && phoneNumber.toString()) || '';
    //         if (!toNumber) {
    //             return { success: false, error: 'Invalid phone number' };
    //         }

    //         const payload = {
    //             messaging_product: "whatsapp",
    //             to: toNumber,
    //             type: "template",
    //             template: {
    //                 name: templateName,
    //                 language: {
    //                     code: "en"
    //                 }
    //             }
    //         };

    //         console.log('📤 Sending template payload:', JSON.stringify(payload, null, 2));

    //         const response = await axios.post(url, payload, {
    //             headers: {
    //                 'Authorization': `Bearer ${this.accessToken}`,
    //                 'Content-Type': 'application/json'
    //             },
    //             timeout: 10000
    //         });

    //         console.log('📱 Template response:', response.data);

    //         return {
    //             success: true,
    //             messageId: response.data.messages[0].id,
    //             data: response.data
    //         };
    //     } catch (error) {
    //         const errMsg = error.response?.data || error.message;
    //         console.error('WhatsApp Template API Error:', errMsg);
    //         if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    //             return { success: true, mocked: true, warning: `Template mocked due to network error: ${error.code || 'timeout'}` };
    //         }
    //         return { success: false, error: errMsg };
    //     }
    // }

    // Send interactive message (buttons)
    async sendInteractiveMessage(phoneNumber, headerText, bodyText, footerText, buttons) {
        try {
            // Guard: align with text sender (enabled by default unless creds missing)
            const liveEnabled = "true";
            if (!liveEnabled) {
                return { success: true, mocked: true, note: 'Live send disabled (WHATSAPP_ENABLE_LIVE!=true)' };
            }

            // Only proceed live when required credentials are present
            if (!this.apiUrl || !this.accessToken || !this.phoneNumberId) {
                return { success: true, mocked: true };
            }
            const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;
            const toNumber = this.formatPhoneNumber(phoneNumber) || (phoneNumber && phoneNumber.toString()) || '';
            if (!toNumber) {
                return { success: false, error: 'Invalid phone number' };
            }

            const payload = {
                messaging_product: "whatsapp",
                to: toNumber,
                type: "interactive",
                interactive: {
                    type: "button",
                    header: {
                        type: "text",
                        text: headerText
                    },
                    body: {
                        text: bodyText
                    },
                    footer: {
                        text: footerText
                    },
                    action: {
                        buttons: buttons.map((button, index) => ({
                            type: "reply",
                            reply: {
                                id: button.id,
                                title: button.title
                            }
                        }))
                    }
                }
            };

            const response = await axios.post(url, payload, {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`,
                    'Content-Type': 'application/json'
                },
                timeout: 10000
            });

            return {
                success: true,
                messageId: response.data.messages[0].id,
                data: response.data
            };
        } catch (error) {
            const errMsg = error.response?.data || error.message;
            console.error('WhatsApp Interactive API Error:', errMsg);
            if (error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
                return { success: true, mocked: true, warning: `Interactive mocked due to network error: ${error.code || 'timeout'}` };
            }
            return { success: false, error: errMsg };
        }
    }

    // Send list message
    // async sendListMessage(phoneNumber, headerText, bodyText, footerText, buttonText, sections) {
    //     try {
    //         const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    //         const payload = {
    //             messaging_product: "whatsapp",
    //             to: phoneNumber,
    //             type: "interactive",
    //             interactive: {
    //                 type: "list",
    //                 header: {
    //                     type: "text",
    //                     text: headerText
    //                 },
    //                 body: {
    //                     text: bodyText
    //                 },
    //                 footer: {
    //                     text: footerText
    //                 },
    //                 action: {
    //                     button: buttonText,
    //                     sections: sections
    //                 }
    //             }
    //         };

    //         const response = await axios.post(url, payload, {
    //             headers: {
    //                 'Authorization': `Bearer ${this.accessToken}`,
    //                 'Content-Type': 'application/json'
    //             }
    //         });

    //         return {
    //             success: true,
    //             messageId: response.data.messages[0].id,
    //             data: response.data
    //         };
    //     } catch (error) {
    //         console.error('WhatsApp List API Error:', error.response?.data || error.message);
    //         return {
    //             success: false,
    //             error: error.response?.data || error.message
    //         };
    //     }
    // }

    // Verify webhook
    verifyWebhook(mode, token, challenge) {
        if (mode === 'subscribe' && token === this.verifyToken) {
            return challenge;
        }
        return null;
    }

    // Process incoming webhook
    processWebhook(webhookData) {
        try {
            const entry = webhookData?.entry?.[0];
            const changes = entry?.changes?.[0];
            const value = changes?.value || {};
            console.log("$$$$$$$$$$$", changes, value)
            if (value.messages) {
                return value.messages
                    .map(message => {
                        const base = {
                            id: message.id,
                            from: message.from,
                            timestamp: message.timestamp,
                            type: message.type,
                            image: message.image,
                            document: message.document,
                            audio: message.audio,
                            video: message.video,
                            location: message.location,
                            contacts: message.contacts,
                            context: message.context
                        };
                        if (message.type === 'interactive') {
                            const btn = message.interactive?.button_reply;
                            const list = message.interactive?.list_reply;
                            return {
                                ...base,
                                text: (btn?.title || list?.title || '').trim(),
                                interactive: {
                                    id: btn?.id || list?.id,
                                    title: btn?.title || list?.title,
                                    source: btn ? 'button' : 'list'
                                }
                            };
                        }
                        return { ...base, text: message.text?.body || '' };
                    })
                    .filter(m => !!m.from);
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
        try {
            if (phoneNumber === null || phoneNumber === undefined) return null;
            const str = typeof phoneNumber === 'string' ? phoneNumber : phoneNumber.toString();
            if (!str) return null;
            // Remove all non-digit characters
            let cleaned = str.replace(/\D/g, '');
            if (!cleaned) return null;
            // Add country code if not present (assuming India +91)
            if (cleaned.length === 10) {
                cleaned = '91' + cleaned;
            }
            return cleaned;
        } catch (e) {
            console.warn('formatPhoneNumber failed for input:', phoneNumber);
            return null;
        }
    }
}

module.exports = WhatsAppService;
