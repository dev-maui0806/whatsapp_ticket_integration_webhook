const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function setupDatabase() {
    console.log('🗄️  Setting up WhatsApp Ticketing Database');
    console.log('==========================================');

    try {
        // First connect without database to create it
        const connectionConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || ''
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

        // Create database
        console.log('2. Creating database...');
        const dbName = process.env.DB_NAME || 'whatsapp_ticketing';
        
        await new Promise((resolve, reject) => {
            connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log(`   ✅ Database '${dbName}' created/verified`);

        // Read and execute schema
        console.log('3. Executing database schema...');
        const schemaPath = path.join(__dirname, 'database', 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        // Split schema into individual statements
        const statements = schema
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

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

        // Close connection
        connection.end();

        console.log('\n🎉 Database setup completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Configure your .env file with WhatsApp API credentials');
        console.log('2. Run: npm start');
        console.log('3. Access dashboard at: http://localhost:3000');

    } catch (error) {
        console.error('❌ Database setup failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure MySQL server is running');
        console.log('2. Check database credentials in .env file');
        console.log('3. Ensure MySQL user has CREATE DATABASE privileges');
        console.log('4. Try running manually: mysql -u root -p < database/schema.sql');
    }
}

// Run setup
setupDatabase();
