const mysql = require('mysql2');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function applyMilestone1MigrationV2() {
    console.log('🔄 Applying Milestone 1 Database Migration - Version 2');
    console.log('=====================================================');

    let connection = null;

    try {
        // Connect to database
        const connectionConfig = {
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'whatsapp_ticketing'
        };

        console.log('1. Connecting to database...');
        connection = mysql.createConnection(connectionConfig);
        
        await new Promise((resolve, reject) => {
            connection.connect((err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        console.log('   ✅ Connected to database');

        // Read and execute migration
        console.log('2. Executing migration...');
        const migrationPath = path.join(__dirname, 'milestone1_migration_v2.sql');
        const migration = fs.readFileSync(migrationPath, 'utf8');

        // Split migration into individual statements
        const statements = migration
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

        for (const statement of statements) {
            if (statement.trim()) {
                try {
                    await new Promise((resolve, reject) => {
                        connection.query(statement, (err) => {
                            if (err) {
                                // Ignore errors for ALTER TABLE statements that might already exist
                                if (err.code === 'ER_DUP_FIELDNAME' || 
                                    err.code === 'ER_CANT_DROP_FIELD_OR_KEY' ||
                                    err.code === 'ER_DUP_KEYNAME') {
                                    console.log(`   ⚠️  Skipped (already exists): ${statement.substring(0, 50)}...`);
                                    resolve();
                                } else {
                                    reject(err);
                                }
                            } else {
                                resolve();
                            }
                        });
                    });
                } catch (error) {
                    console.error(`   ❌ Error executing: ${statement.substring(0, 50)}...`);
                    console.error(`   Error details: ${error.message}`);
                    throw error;
                }
            }
        }

        console.log('   ✅ Migration executed successfully');

        console.log('\n🎉 Milestone 1 Migration V2 completed successfully!');
        console.log('\nNew features enabled:');
        console.log('✅ Interactive form flow for ticket creation');
        console.log('✅ Enhanced ticket types (Fund Request, Fuel Request)');
        console.log('✅ User session state tracking');
        console.log('✅ Form validation and field collection');
        console.log('✅ Fixed messages table to allow NULL ticket_id');

    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure the database exists and is accessible');
        console.log('2. Check database credentials in .env file');
        console.log('3. Ensure you have ALTER TABLE privileges');
        process.exit(1);
    } finally {
        // Properly close connection
        if (connection) {
            try {
                await new Promise((resolve, reject) => {
                    connection.end((err) => {
                        if (err) {
                            console.error('Warning: Error closing database connection:', err.message);
                        }
                        resolve();
                    });
                });
            } catch (closeError) {
                console.error('Warning: Error closing database connection:', closeError.message);
            }
        }
    }
}

// Run migration if called directly
if (require.main === module) {
    applyMilestone1MigrationV2()
        .then(() => {
            console.log('\n✅ Migration script completed successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Migration script failed:', error.message);
            process.exit(1);
        });
}

module.exports = applyMilestone1MigrationV2; 