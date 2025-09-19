const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixJsonParsingError() {
    let connection;
    
    try {
        console.log('🔧 Fixing JSON parsing error in conversation states...');
        
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_ticketing',
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Step 1: Check if bot_conversation_states table exists
        const tableCheck = await connection.execute(`
            SELECT TABLE_NAME 
            FROM INFORMATION_SCHEMA.TABLES 
            WHERE TABLE_NAME = 'bot_conversation_states'
        `);
        
        if (tableCheck[0].length === 0) {
            console.log('⚠️ bot_conversation_states table does not exist. Creating it...');
            
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
        
        // Step 2: Check for problematic form_data entries
        console.log('🔍 Checking for problematic form_data entries...');
        
        const problematicEntries = await connection.execute(`
            SELECT id, phone_number, form_data 
            FROM bot_conversation_states 
            WHERE form_data = '[object Object]' 
               OR form_data = '"[object Object]"'
               OR form_data = 'null'
               OR form_data = 'undefined'
        `);
        
        if (problematicEntries[0].length > 0) {
            console.log(`⚠️ Found ${problematicEntries[0].length} problematic entries:`);
            problematicEntries[0].forEach(entry => {
                console.log(`  - Phone: ${entry.phone_number}, Form Data: ${entry.form_data}`);
            });
            
            // Fix problematic entries
            await connection.execute(`
                UPDATE bot_conversation_states 
                SET form_data = '{}' 
                WHERE form_data = '[object Object]' 
                   OR form_data = '"[object Object]"'
                   OR form_data = 'null'
                   OR form_data = 'undefined'
            `);
            
            console.log('✅ Fixed problematic form_data entries');
        } else {
            console.log('✅ No problematic form_data entries found');
        }
        
        // Step 3: Validate all JSON data
        console.log('🔍 Validating all JSON data...');
        
        const allStates = await connection.execute(`
            SELECT id, phone_number, form_data 
            FROM bot_conversation_states 
            WHERE form_data IS NOT NULL
        `);
        
        let validCount = 0;
        let invalidCount = 0;
        
        for (const state of allStates[0]) {
            try {
                if (typeof state.form_data === 'string') {
                    JSON.parse(state.form_data);
                } else if (typeof state.form_data === 'object') {
                    // Already parsed JSON object
                }
                validCount++;
            } catch (error) {
                console.log(`⚠️ Invalid JSON for phone ${state.phone_number}: ${state.form_data}`);
                invalidCount++;
                
                // Fix invalid JSON by setting to empty object
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
        
        // Step 4: Check for any remaining issues
        const remainingIssues = await connection.execute(`
            SELECT COUNT(*) as count 
            FROM bot_conversation_states 
            WHERE form_data IS NOT NULL 
              AND form_data != '{}'
              AND form_data != 'null'
        `);
        
        console.log(`📊 Remaining non-empty form_data entries: ${remainingIssues[0][0].count}`);
        
        // Step 5: Test the fix by simulating a query
        console.log('🧪 Testing the fix...');
        
        const testQuery = await connection.execute(`
            SELECT phone_number, form_data 
            FROM bot_conversation_states 
            LIMIT 5
        `);
        
        console.log('📋 Sample data after fix:');
        testQuery[0].forEach((row, index) => {
            console.log(`  ${index + 1}. Phone: ${row.phone_number}, Form Data: ${JSON.stringify(row.form_data)}`);
        });
        
        console.log('');
        console.log('🎉 JSON parsing error fix completed successfully!');
        console.log('');
        console.log('📝 Summary of fixes:');
        console.log('  ✅ Created bot_conversation_states table if missing');
        console.log('  ✅ Fixed "[object Object]" entries');
        console.log('  ✅ Fixed invalid JSON entries');
        console.log('  ✅ Validated all remaining data');
        console.log('');
        console.log('🚀 The application should now work without JSON parsing errors!');
        
    } catch (error) {
        console.error('❌ Fix failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run the fix
fixJsonParsingError();
