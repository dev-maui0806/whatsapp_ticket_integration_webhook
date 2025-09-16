const { testConnection } = require('./config/database');
const Ticket = require('./models/Ticket');
const Customer = require('./models/Customer');
const WhatsAppService = require('./services/whatsappService');

async function testSetup() {
    console.log('🧪 Testing WhatsApp Ticketing System Setup');
    console.log('==========================================');

    try {
        // Test database connection
        console.log('1. Testing database connection...');
        const dbConnected = await testConnection();
        if (dbConnected) {
            console.log('   ✅ Database connection successful');
        } else {
            console.log('   ❌ Database connection failed');
            return;
        }

        // Test models
        console.log('\n2. Testing models...');
        
        // Test Customer model
        const testCustomer = await Customer.findByPhone('+919876543210');
        if (testCustomer) {
            console.log('   ✅ Customer model working');
        } else {
            console.log('   ✅ Customer model working (no test customer found)');
        }

        // Test Ticket model
        const tickets = await Ticket.getAll(1, 5);
        if (tickets.success) {
            console.log('   ✅ Ticket model working');
        } else {
            console.log('   ❌ Ticket model failed:', tickets.error);
        }

        // Test WhatsApp service
        console.log('\n3. Testing WhatsApp service...');
        const whatsappService = new WhatsAppService();
        if (whatsappService.apiUrl && whatsappService.accessToken) {
            console.log('   ✅ WhatsApp service initialized');
        } else {
            console.log('   ⚠️  WhatsApp service needs configuration');
        }

        console.log('\n🎉 Setup test completed successfully!');
        console.log('\nNext steps:');
        console.log('1. Configure your .env file with database and WhatsApp API credentials');
        console.log('2. Run: npm start');
        console.log('3. Access dashboard at: http://localhost:3000');
        console.log('4. Set up WhatsApp webhook URL: http://yourdomain.com/webhook');

    } catch (error) {
        console.error('❌ Setup test failed:', error.message);
        console.log('\nTroubleshooting:');
        console.log('1. Make sure MySQL is running');
        console.log('2. Check database credentials in .env');
        console.log('3. Run database schema: mysql -u root -p < database/schema.sql');
    }
}

// Run test
testSetup();
