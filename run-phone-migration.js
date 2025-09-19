const mysql = require('mysql2/promise');
require('dotenv').config();

async function runMigration() {
    let connection;
    
    try {
        console.log('🔄 Starting phone number migration...');
        
        // Create database connection
        connection = await mysql.createConnection({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_ticketing',
            multipleStatements: true
        });
        
        console.log('✅ Connected to database');
        
        // Read migration file
        const fs = require('fs');
        const migrationSQL = fs.readFileSync('./database/phone_number_migration.sql', 'utf8');
        
        // Execute migration
        console.log('🔄 Executing migration...');
        await connection.execute(migrationSQL);
        
        console.log('✅ Migration completed successfully!');
        console.log('');
        console.log('📋 Changes made:');
        console.log('  - Added phone_number column to messages table');
        console.log('  - Added indexes for better performance');
        console.log('  - Created customer_chat_sessions table');
        console.log('  - Created bot_conversation_states table');
        console.log('  - Created ticket_form_fields table');
        console.log('  - Updated existing messages with phone numbers');
        console.log('');
        console.log('🎉 Phone number-based chat system is now ready!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Run migration
runMigration();
