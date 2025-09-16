const { executeQuery } = require('./config/database');

async function setupDatabase() {
    console.log('🚀 Setting up Enhanced Ticketing Database...\n');
    
    try {
        // Step 1: Add new columns to tickets table
        console.log('📊 Adding new columns to tickets table...');
        
        const alterStatements = [
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) NULL",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255) NULL", 
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS quantity INT NULL",
            "ALTER TABLE tickets ADD COLUMN IF NOT EXISTS fuel_type ENUM('amount', 'quantity') NULL"
        ];
        
        for (const statement of alterStatements) {
            try {
                await executeQuery(statement);
                console.log('✅ Column added successfully');
            } catch (error) {
                if (error.message.includes('Duplicate column name')) {
                    console.log('⚠️  Column already exists, skipping');
                } else {
                    console.log('❌ Error adding column:', error.message);
                }
            }
        }
        
        // Step 2: Update issue_type enum
        console.log('\n📝 Updating issue_type enum...');
        try {
            await executeQuery(`
                ALTER TABLE tickets 
                MODIFY COLUMN issue_type ENUM(
                    'lock_open', 
                    'lock_repair', 
                    'fund_request', 
                    'fuel_request', 
                    'other'
                ) NOT NULL
            `);
            console.log('✅ Issue type enum updated');
        } catch (error) {
            console.log('⚠️  Issue type enum update failed:', error.message);
        }
        
        // Step 3: Create conversation_states table
        console.log('\n🗂️  Creating conversation_states table...');
        try {
            await executeQuery(`
                CREATE TABLE IF NOT EXISTS conversation_states (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    phone_number VARCHAR(20) NOT NULL,
                    current_step VARCHAR(50) NOT NULL,
                    ticket_type VARCHAR(50) NULL,
                    form_data JSON NULL,
                    current_ticket_id INT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
                    UNIQUE KEY unique_phone_state (phone_number)
                )
            `);
            console.log('✅ conversation_states table created');
        } catch (error) {
            console.log('⚠️  conversation_states table creation failed:', error.message);
        }
        
        // Step 4: Create ticket_form_fields table
        console.log('\n📋 Creating ticket_form_fields table...');
        try {
            await executeQuery(`
                CREATE TABLE IF NOT EXISTS ticket_form_fields (
                    id INT PRIMARY KEY AUTO_INCREMENT,
                    ticket_type VARCHAR(50) NOT NULL,
                    field_name VARCHAR(50) NOT NULL,
                    field_label VARCHAR(100) NOT NULL,
                    field_type ENUM('text', 'number', 'date', 'time', 'select') NOT NULL,
                    is_required BOOLEAN DEFAULT TRUE,
                    validation_rules JSON NULL,
                    display_order INT DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            `);
            console.log('✅ ticket_form_fields table created');
        } catch (error) {
            console.log('⚠️  ticket_form_fields table creation failed:', error.message);
        }
        
        // Step 5: Insert form field definitions
        console.log('\n📝 Inserting form field definitions...');
        
        const formFields = [
            // Lock Open fields
            ['lock_open', 'vehicle_number', 'Vehicle Number', 'text', true, '{"max_length": 20}', 1],
            ['lock_open', 'driver_number', 'Driver Number', 'text', true, '{"max_length": 20}', 2],
            ['lock_open', 'location', 'Location', 'text', true, '{"max_length": 255}', 3],
            ['lock_open', 'comment', 'Comment', 'text', false, '{"max_length": 500}', 4],
            
            // Lock Repair fields
            ['lock_repair', 'vehicle_number', 'Vehicle Number', 'text', true, '{"max_length": 20}', 1],
            ['lock_repair', 'driver_number', 'Driver Number', 'text', true, '{"max_length": 20}', 2],
            ['lock_repair', 'location', 'Location', 'text', true, '{"max_length": 255}', 3],
            ['lock_repair', 'availability_date', 'Available Date', 'date', true, null, 4],
            ['lock_repair', 'availability_time', 'Available Time', 'time', true, null, 5],
            ['lock_repair', 'comment', 'Comment', 'text', false, '{"max_length": 500}', 6],
            
            // Fund Request fields
            ['fund_request', 'vehicle_number', 'Vehicle Number', 'text', true, '{"max_length": 20}', 1],
            ['fund_request', 'driver_number', 'Driver Number', 'text', true, '{"max_length": 20}', 2],
            ['fund_request', 'amount', 'Amount', 'number', true, '{"max": 99999, "min": 1}', 3],
            ['fund_request', 'upi_id', 'UPI ID', 'text', true, '{"max_length": 255}', 4],
            ['fund_request', 'comment', 'Comment', 'text', false, '{"max_length": 500}', 5],
            
            // Fuel Request fields
            ['fuel_request', 'fuel_type', 'Fuel Type', 'select', true, '{"options": ["amount", "quantity"]}', 1],
            ['fuel_request', 'vehicle_number', 'Vehicle Number', 'text', true, '{"max_length": 20}', 2],
            ['fuel_request', 'driver_number', 'Driver Number', 'text', true, '{"max_length": 20}', 3],
            ['fuel_request', 'amount', 'Amount', 'number', false, '{"max": 99999, "min": 1}', 4],
            ['fuel_request', 'quantity', 'Quantity', 'number', false, '{"max": 9999, "min": 1}', 5],
            ['fuel_request', 'upi_id', 'UPI ID', 'text', false, '{"max_length": 255}', 6],
            ['fuel_request', 'comment', 'Comment', 'text', false, '{"max_length": 500}', 7],
            
            // Other fields
            ['other', 'comment', 'Comment', 'text', true, '{"max_length": 500}', 1]
        ];
        
        for (const field of formFields) {
            try {
                await executeQuery(`
                    INSERT IGNORE INTO ticket_form_fields 
                    (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `, field);
            } catch (error) {
                console.log('⚠️  Error inserting field:', field[1], error.message);
            }
        }
        console.log('✅ Form field definitions inserted');
        
        // Step 6: Create indexes
        console.log('\n🔍 Creating indexes...');
        const indexes = [
            "CREATE INDEX IF NOT EXISTS idx_conversation_states_phone ON conversation_states(phone_number)",
            "CREATE INDEX IF NOT EXISTS idx_conversation_states_step ON conversation_states(current_step)",
            "CREATE INDEX IF NOT EXISTS idx_ticket_form_fields_type ON ticket_form_fields(ticket_type)",
            "CREATE INDEX IF NOT EXISTS idx_tickets_issue_type ON tickets(issue_type)"
        ];
        
        for (const index of indexes) {
            try {
                await executeQuery(index);
                console.log('✅ Index created');
            } catch (error) {
                console.log('⚠️  Index creation failed:', error.message);
            }
        }
        
        // Step 7: Update existing tickets
        console.log('\n🔄 Updating existing tickets...');
        try {
            await executeQuery("UPDATE tickets SET issue_type = 'other' WHERE issue_type = 'vehicle_status'");
            console.log('✅ Existing tickets updated');
        } catch (error) {
            console.log('⚠️  Ticket update failed:', error.message);
        }
        
        console.log('\n✅ Database setup completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Test the system: node test-enhanced-ticketing.js');
        console.log('2. Start the server: npm start');
        console.log('3. Update WhatsApp webhook URL to: /enhanced-webhook');
        
    } catch (error) {
        console.error('\n❌ Database setup failed:', error);
        throw error;
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupDatabase().then(() => {
        console.log('\n🎉 Setup completed!');
        process.exit(0);
    }).catch(error => {
        console.error('\n💥 Setup failed:', error);
        process.exit(1);
    });
}

module.exports = setupDatabase;
