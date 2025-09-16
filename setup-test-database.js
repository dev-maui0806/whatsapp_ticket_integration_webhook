const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');

async function setupTestDatabase() {
    console.log('🗄️  Setting up Test Database');
    console.log('============================');

    try {
        // Connect to MySQL server
        const connectionConfig = {
            host: 'localhost',
            user: 'root',
            password: ''
        };

        console.log('1. Connecting to MySQL server...');
        const connection = mysql.createConnection(connectionConfig);
        
        await new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('   ✅ Connected to MySQL server');

        // Create test database
        console.log('2. Creating test database...');
        const testDbName = 'whatsapp_ticketing';
        
        await new Promise((resolve, reject) => {
            connection.query(`CREATE DATABASE IF NOT EXISTS ${testDbName}`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`   ✅ Test database '${testDbName}' created/verified`);

        // Use test database
        await new Promise((resolve, reject) => {
            connection.query(`USE ${testDbName}`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        // Read and execute schema
        console.log('3. Executing database schema...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split schema into individual statements and execute
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.toLowerCase().includes('create database'));

        for (const statement of statements) {
            if (statement.trim()) {
                await new Promise((resolve, reject) => {
                    connection.query(statement, (err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        }

        console.log('   ✅ Database schema executed successfully');

        // Insert test data
        console.log('4. Inserting test data...');
        
        const testData = [
            // Test users
            `INSERT IGNORE INTO users (id, name, email, role) VALUES 
             (1, 'Test Agent 1', 'agent1@test.com', 'agent'),
             (2, 'Test Agent 2', 'agent2@test.com', 'agent'),
             (3, 'Test Senior', 'senior@test.com', 'senior')`,
            
            // Test customers
            `INSERT IGNORE INTO customers (id, phone_number, name) VALUES 
             (1, '48794740269', 'Test Customer 1'),
             (2, '48794740270', 'Test Customer 2')`,
            
            // Test tickets
            `INSERT IGNORE INTO tickets (id, ticket_number, customer_id, status, priority, issue_type, vehicle_number, driver_number, location, comment) VALUES 
             (1, 'TKT-TEST-001', 1, 'open', 'medium', 'lock_open', 'ABC123', 'XYZ789', 'Warsaw', 'Test ticket for webhook testing'),
             (2, 'TKT-TEST-002', 2, 'in_progress', 'high', 'repair', 'DEF456', 'UVW012', 'Krakow', 'Another test ticket')`
        ];

        for (const query of testData) {
            await new Promise((resolve, reject) => {
                connection.query(query, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        console.log('   ✅ Test data inserted successfully');

        // Close connection
        connection.end();

        console.log('\n🎉 Test database setup completed successfully!');
        console.log('\nTest data created:');
        console.log('- 3 test users (2 agents, 1 senior)');
        console.log('- 2 test customers');
        console.log('- 2 test tickets');
        console.log('\nYou can now run webhook tests!');

    } catch (error) {
        console.error('❌ Test database setup failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure MySQL server is running');
        console.log('2. Check database credentials');
        console.log('3. Ensure MySQL user has CREATE DATABASE privileges');
    }
}

// Run setup if this file is executed directly
if (require.main === module) {
    setupTestDatabase();
}

module.exports = setupTestDatabase;

