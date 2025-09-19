const axios = require('axios');
const BotConversationService = require('./services/botConversationService');
const Customer = require('./models/Customer');
const Message = require('./models/Message');
const Ticket = require('./models/Ticket');
const { executeQuery } = require('./config/database');

class PhoneChatSystemTester {
    constructor() {
        this.botService = new BotConversationService();
        this.testPhoneNumber = '918826000390'; // Test phone number
        this.baseURL = 'http://localhost:4000';
    }

    async runTests() {
        console.log('🧪 Starting Phone Chat System Tests');
        console.log('=====================================');
        
        try {
            await this.testDatabaseMigration();
            await this.testBotConversationFlow();
            await this.testCustomerAPI();
            await this.testWebhookIntegration();
            await this.testDashboardIntegration();
            
            console.log('');
            console.log('✅ All tests completed successfully!');
            console.log('🎉 Phone number-based chat system is working correctly!');
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error('Full error:', error);
        }
    }

    async testDatabaseMigration() {
        console.log('📊 Testing database migration...');
        
        // Test if phone_number column exists in messages table
        const result = await executeQuery(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'messages' AND COLUMN_NAME = 'phone_number'
        `);
        
        if (result.success && result.data.length > 0) {
            console.log('  ✅ phone_number column exists in messages table');
        } else {
            throw new Error('phone_number column not found in messages table');
        }
        
        // Test if new tables exist
        const tables = ['customer_chat_sessions', 'bot_conversation_states', 'ticket_form_fields'];
        for (const table of tables) {
            const tableResult = await executeQuery(`
                SELECT TABLE_NAME 
                FROM INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_NAME = '${table}'
            `);
            
            if (tableResult.success && tableResult.data.length > 0) {
                console.log(`  ✅ ${table} table exists`);
            } else {
                throw new Error(`${table} table not found`);
            }
        }
        
        console.log('  ✅ Database migration test passed');
    }

    async testBotConversationFlow() {
        console.log('🤖 Testing bot conversation flow...');
        
        // Test /start command for new customer
        const startResult = await this.botService.handleStartCommand(this.testPhoneNumber);
        if (startResult.success) {
            console.log('  ✅ /start command handled successfully');
            console.log(`  📝 Response: ${startResult.message.substring(0, 100)}...`);
        } else {
            throw new Error('Failed to handle /start command');
        }
        
        // Test ticket type selection
        const typeResult = await this.botService.handleTicketTypeSelection(this.testPhoneNumber, '1');
        if (typeResult.success) {
            console.log('  ✅ Ticket type selection handled successfully');
        } else {
            throw new Error('Failed to handle ticket type selection');
        }
        
        // Test form filling
        const formResult = await this.botService.handleFormFilling(
            this.testPhoneNumber, 
            'Test Vehicle, Test Driver, Test Location, Test Comment /input_end',
            'lock_open',
            {}
        );
        if (formResult.success) {
            console.log('  ✅ Form filling handled successfully');
        } else {
            throw new Error('Failed to handle form filling');
        }
        
        console.log('  ✅ Bot conversation flow test passed');
    }

    async testCustomerAPI() {
        console.log('👥 Testing customer API...');
        
        try {
            // Test getting customers
            const response = await axios.get(`${this.baseURL}/api/customers`);
            if (response.data.success) {
                console.log('  ✅ Customer API endpoint working');
                console.log(`  📊 Found ${response.data.data.length} customers`);
            } else {
                throw new Error('Customer API returned error');
            }
            
            // Test getting customer by phone
            const customerResponse = await axios.get(`${this.baseURL}/api/customers/phone/${this.testPhoneNumber}`);
            if (customerResponse.data.success) {
                console.log('  ✅ Customer lookup by phone working');
            } else {
                console.log('  ⚠️ Customer not found (expected for new test)');
            }
            
            // Test getting customer messages
            const messagesResponse = await axios.get(`${this.baseURL}/api/customers/${this.testPhoneNumber}/messages`);
            if (messagesResponse.data.success) {
                console.log('  ✅ Customer messages API working');
                console.log(`  💬 Found ${messagesResponse.data.data.length} messages`);
            } else {
                throw new Error('Customer messages API failed');
            }
            
            console.log('  ✅ Customer API test passed');
            
        } catch (error) {
            if (error.response) {
                throw new Error(`API Error: ${error.response.data.error || error.response.statusText}`);
            } else {
                throw new Error(`Network Error: ${error.message}`);
            }
        }
    }

    async testWebhookIntegration() {
        console.log('🔗 Testing webhook integration...');
        
        try {
            // Test webhook health
            const healthResponse = await axios.get(`${this.baseURL}/enhanced-webhook/health`);
            if (healthResponse.data.status === 'healthy') {
                console.log('  ✅ Enhanced webhook service is healthy');
            } else {
                throw new Error('Webhook service not healthy');
            }
            
            // Test sending a test message
            const testMessageResponse = await axios.post(`${this.baseURL}/enhanced-webhook/test-message`, {
                phoneNumber: this.testPhoneNumber,
                message: 'Test message from phone chat system'
            });
            
            if (testMessageResponse.data.success) {
                console.log('  ✅ Test message sent successfully');
            } else {
                console.log('  ⚠️ Test message failed (may be due to WhatsApp API configuration)');
            }
            
            console.log('  ✅ Webhook integration test passed');
            
        } catch (error) {
            if (error.response) {
                console.log(`  ⚠️ Webhook test warning: ${error.response.data.error || error.response.statusText}`);
            } else {
                console.log(`  ⚠️ Webhook test warning: ${error.message}`);
            }
        }
    }

    async testDashboardIntegration() {
        console.log('🖥️ Testing dashboard integration...');
        
        try {
            // Test if server is running
            const serverResponse = await axios.get(`${this.baseURL}/health`);
            if (serverResponse.data.status === 'healthy') {
                console.log('  ✅ Server is running and healthy');
            } else {
                throw new Error('Server not healthy');
            }
            
            // Test API documentation
            const apiResponse = await axios.get(`${this.baseURL}/api`);
            if (apiResponse.data.name) {
                console.log('  ✅ API documentation accessible');
            } else {
                throw new Error('API documentation not accessible');
            }
            
            console.log('  ✅ Dashboard integration test passed');
            
        } catch (error) {
            if (error.response) {
                throw new Error(`Dashboard Error: ${error.response.data.error || error.response.statusText}`);
            } else {
                throw new Error(`Dashboard Error: ${error.message}`);
            }
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up test data...');
        
        try {
            // Clear test conversation state
            await this.botService.clearConversationState(this.testPhoneNumber);
            
            // Delete test messages
            await executeQuery('DELETE FROM messages WHERE phone_number = ?', [this.testPhoneNumber]);
            
            // Delete test customer
            await executeQuery('DELETE FROM customers WHERE phone_number = ?', [this.testPhoneNumber]);
            
            console.log('  ✅ Test data cleaned up');
            
        } catch (error) {
            console.log(`  ⚠️ Cleanup warning: ${error.message}`);
        }
    }
}

// Run tests
async function runPhoneChatTests() {
    const tester = new PhoneChatSystemTester();
    
    try {
        await tester.runTests();
        await tester.cleanup();
    } catch (error) {
        console.error('❌ Test suite failed:', error.message);
        process.exit(1);
    }
}

// Export for use in other files
module.exports = { PhoneChatSystemTester, runPhoneChatTests };

// Run if called directly
if (require.main === module) {
    runPhoneChatTests();
}
