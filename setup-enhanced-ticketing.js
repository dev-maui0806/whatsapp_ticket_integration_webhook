const { executeQuery } = require('./config/database');
const fs = require('fs');
const path = require('path');

class EnhancedTicketingSetup {
    constructor() {
        this.setupComplete = false;
    }

    async runSetup() {
        console.log('🚀 Setting up Enhanced Ticketing System...\n');
        
        try {
            // Step 1: Apply database schema updates
            await this.applyDatabaseUpdates();
            
            // Step 2: Verify database structure
            await this.verifyDatabaseStructure();
            
            // Step 3: Test basic functionality
            await this.testBasicFunctionality();
            
            console.log('\n✅ Enhanced Ticketing System setup completed successfully!');
            console.log('\n📋 Next Steps:');
            console.log('1. Update your WhatsApp webhook URL to: /enhanced-webhook');
            console.log('2. Test the system with: node test-enhanced-ticketing.js');
            console.log('3. Start the server: npm start');
            console.log('\n🎯 Available endpoints:');
            console.log('- POST /enhanced-webhook - WhatsApp webhook');
            console.log('- GET /enhanced-webhook/conversation-state/:phoneNumber - Get conversation state');
            console.log('- DELETE /enhanced-webhook/conversation-state/:phoneNumber - Clear conversation state');
            console.log('- GET /enhanced-webhook/open-tickets/:phoneNumber - Get open tickets');
            console.log('- POST /enhanced-webhook/send-test-message - Send test message');
            console.log('- POST /enhanced-webhook/test-create-ticket - Create test ticket');
            
            this.setupComplete = true;
            
        } catch (error) {
            console.error('\n❌ Setup failed:', error);
            throw error;
        }
    }

    async applyDatabaseUpdates() {
        console.log('📊 Applying database schema updates...');
        
        try {
            // Read the SQL file
            const sqlFilePath = path.join(__dirname, 'database', 'update_schema_for_ticketing.sql');
            const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
            
            // Split into individual statements
            const statements = sqlContent
                .split(';')
                .map(stmt => stmt.trim())
                .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
            
            console.log(`Found ${statements.length} SQL statements to execute`);
            
            // Execute each statement
            for (let i = 0; i < statements.length; i++) {
                const statement = statements[i];
                if (statement.trim()) {
                    try {
                        console.log(`Executing statement ${i + 1}/${statements.length}...`);
                        await executeQuery(statement);
                    } catch (error) {
                        // Some statements might fail if they already exist, which is okay
                        if (error.message.includes('already exists') || 
                            error.message.includes('Duplicate column name') ||
                            error.message.includes('Duplicate key name')) {
                            console.log(`  ⚠️  Statement ${i + 1} skipped (already exists)`);
                        } else {
                            console.log(`  ❌ Statement ${i + 1} failed:`, error.message);
                            throw error;
                        }
                    }
                }
            }
            
            console.log('✅ Database schema updates applied successfully');
            
        } catch (error) {
            console.error('❌ Failed to apply database updates:', error);
            throw error;
        }
    }

    async verifyDatabaseStructure() {
        console.log('\n🔍 Verifying database structure...');
        
        try {
            // Check if conversation_states table exists
            const conversationStatesCheck = await executeQuery(
                "SHOW TABLES LIKE 'conversation_states'"
            );
            
            if (conversationStatesCheck.success && conversationStatesCheck.data.length > 0) {
                console.log('✅ conversation_states table exists');
            } else {
                throw new Error('conversation_states table not found');
            }
            
            // Check if ticket_form_fields table exists
            const formFieldsCheck = await executeQuery(
                "SHOW TABLES LIKE 'ticket_form_fields'"
            );
            
            if (formFieldsCheck.success && formFieldsCheck.data.length > 0) {
                console.log('✅ ticket_form_fields table exists');
            } else {
                throw new Error('ticket_form_fields table not found');
            }
            
            // Check if new columns exist in tickets table
            const ticketsColumnsCheck = await executeQuery(
                "SHOW COLUMNS FROM tickets LIKE 'amount'"
            );
            
            if (ticketsColumnsCheck.success && ticketsColumnsCheck.data.length > 0) {
                console.log('✅ New columns added to tickets table');
            } else {
                throw new Error('New columns not found in tickets table');
            }
            
            // Check form fields data
            const formFieldsCount = await executeQuery(
                "SELECT COUNT(*) as count FROM ticket_form_fields"
            );
            
            if (formFieldsCount.success && formFieldsCount.data.length > 0) {
                console.log(`✅ ${formFieldsCount.data[0].count} form field definitions loaded`);
            } else {
                throw new Error('Form field definitions not found');
            }
            
            console.log('✅ Database structure verification completed');
            
        } catch (error) {
            console.error('❌ Database structure verification failed:', error);
            throw error;
        }
    }

    async testBasicFunctionality() {
        console.log('\n🧪 Testing basic functionality...');
        
        try {
            // Test conversation state service
            const ConversationStateService = require('./services/conversationStateService');
            const conversationService = new ConversationStateService();
            
            const testPhoneNumber = '1234567890';
            
            // Test setting state
            const setResult = await conversationService.setState(testPhoneNumber, {
                currentStep: 'test',
                ticketType: 'other',
                formData: { test: 'value' },
                currentTicketId: null
            });
            
            if (setResult.success) {
                console.log('✅ Conversation state service working');
            } else {
                throw new Error('Conversation state service test failed');
            }
            
            // Test getting state
            const getResult = await conversationService.getState(testPhoneNumber);
            
            if (getResult.success && getResult.data) {
                console.log('✅ State retrieval working');
            } else {
                throw new Error('State retrieval test failed');
            }
            
            // Test clearing state
            const clearResult = await conversationService.clearState(testPhoneNumber);
            
            if (clearResult.success) {
                console.log('✅ State clearing working');
            } else {
                throw new Error('State clearing test failed');
            }
            
            // Test enhanced ticket service
            const EnhancedTicketService = require('./services/enhancedTicketService');
            const ticketService = new EnhancedTicketService();
            
            const openTicketsResult = await ticketService.checkOpenTickets(testPhoneNumber);
            
            if (openTicketsResult.success) {
                console.log('✅ Enhanced ticket service working');
            } else {
                throw new Error('Enhanced ticket service test failed');
            }
            
            console.log('✅ Basic functionality tests passed');
            
        } catch (error) {
            console.error('❌ Basic functionality test failed:', error);
            throw error;
        }
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    const setup = new EnhancedTicketingSetup();
    setup.runSetup().then(() => {
        console.log('\n🎉 Setup completed successfully!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Setup failed:', error);
        process.exit(1);
    });
}

module.exports = EnhancedTicketingSetup;
