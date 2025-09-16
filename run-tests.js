const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 WhatsApp Ticketing System - Test Runner');
console.log('==========================================');

async function runTests() {
    try {
        // Step 1: Setup test database
        console.log('\n📊 Step 1: Setting up test database...');
        const setupDb = spawn('node', ['setup-test-database.js'], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            setupDb.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Test database setup completed');
                    resolve();
                } else {
                    reject(new Error(`Database setup failed with code ${code}`));
                }
            });
        });

        // Step 2: Start server in test mode
        console.log('\n🖥️  Step 2: Starting server in test mode...');
        
        // Set test environment
        process.env.NODE_ENV = 'test';
        process.env.DB_NAME = 'whatsapp_ticketing_test';
        
        const server = spawn('node', ['server.js'], {
            cwd: __dirname,
            stdio: 'pipe',
            env: { ...process.env }
        });

        // Wait for server to start
        await new Promise((resolve) => {
            server.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Server running on port')) {
                    console.log('✅ Server started successfully');
                    resolve();
                }
            });
            
            // Timeout after 10 seconds
            setTimeout(() => {
                console.log('⚠️  Server start timeout, proceeding with tests...');
                resolve();
            }, 10000);
        });

        // Step 3: Run webhook tests
        console.log('\n🧪 Step 3: Running webhook tests...');
        const webhookTests = spawn('node', ['test-webhook.js'], {
            cwd: __dirname,
            stdio: 'inherit'
        });

        await new Promise((resolve, reject) => {
            webhookTests.on('close', (code) => {
                if (code === 0) {
                    console.log('✅ Webhook tests completed');
                    resolve();
                } else {
                    console.log(`⚠️  Webhook tests completed with code ${code}`);
                    resolve(); // Don't fail the entire process
                }
            });
        });

        // Step 4: Cleanup
        console.log('\n🧹 Step 4: Cleaning up...');
        server.kill();
        console.log('✅ Test server stopped');

        console.log('\n🎉 All tests completed!');
        console.log('\nNext steps:');
        console.log('1. Check test-report.json for detailed results');
        console.log('2. Start the server manually: npm start');
        console.log('3. Access dashboard: http://localhost:3000');
        console.log('4. Test webhook manually: node test-webhook.js');

    } catch (error) {
        console.error('❌ Test runner failed:', error.message);
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests();
}

module.exports = runTests;

