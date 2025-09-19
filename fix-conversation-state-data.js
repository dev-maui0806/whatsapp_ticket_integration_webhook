const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixConversationStateData() {
    let connection;
    
    try {
        console.log('🔧 Fixing conversation state data...');
        
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_ticketing',
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Check if bot_conversation_states table exists
        const tableCheck = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'bot_conversation_states'
        `);
        
        if (tableCheck[0].length === 0) {
            console.log('⚠️ bot_conversation_states table does not exist. Creating it...');
            
            // Create the table
            await connection.execute(`
                CREATE TABLE IF NOT EXISTS bot_conversation_states (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    phone_number VARCHAR(20) NOT NULL,
                    current_step VARCHAR(50),
                    ticket_type VARCHAR(50),
                    form_data JSON,
                    current_ticket_id INT,
                    automation_chat_state VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
                    UNIQUE KEY unique_phone (phone_number),
                    INDEX idx_phone_number (phone_number),
                    INDEX idx_current_step (current_step),
                    INDEX idx_automation_chat_state (automation_chat_state)
                )
            `);
            console.log('✅ bot_conversation_states table created');
        }
        
        // Check for problematic data
        const problematicData = await connection.execute(`
            SELECT id, phone_number, form_data 
            FROM bot_conversation_states 
            WHERE form_data = '[object Object]' OR form_data = '"[object Object]"'
        `);
        
        if (problematicData[0].length > 0) {
            console.log(`🔍 Found ${problematicData[0].length} problematic entries`);
            
            // Fix problematic data
            await connection.execute(`
                UPDATE bot_conversation_states 
                SET form_data = '{}' 
                WHERE form_data = '[object Object]' OR form_data = '"[object Object]"'
            `);
            
            console.log('✅ Fixed problematic form_data entries');
        } else {
            console.log('✅ No problematic data found');
        }
        
        // Check for any other potential issues
        const allStates = await connection.execute(`
            SELECT id, phone_number, form_data 
            FROM bot_conversation_states 
            WHERE form_data IS NOT NULL
        `);
        
        console.log(`📊 Total conversation states: ${allStates[0].length}`);
        
        // Validate JSON data
        let validCount = 0;
        let invalidCount = 0;
        
        for (const state of allStates[0]) {
            try {
                if (typeof state.form_data === 'string') {
                    JSON.parse(state.form_data);
                }
                validCount++;
            } catch (error) {
                console.log(`⚠️ Invalid JSON for phone ${state.phone_number}: ${state.form_data}`);
                invalidCount++;
                
                // Fix invalid JSON
                await connection.execute(`
                    UPDATE bot_conversation_states 
                    SET form_data = '{}' 
                    WHERE id = ?
                `, [state.id]);
            }
        }
        
        console.log(`✅ Valid JSON entries: ${validCount}`);
        if (invalidCount > 0) {
            console.log(`🔧 Fixed invalid JSON entries: ${invalidCount}`);
        }
        
        console.log('');
        console.log('🎉 Conversation state data cleanup completed successfully!');
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run cleanup
fixConversationStateData();
