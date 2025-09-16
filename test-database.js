const { testConnection, executeQuery } = require('./config/database');
const Customer = require('./models/Customer');

async function testDatabase() {
    console.log('🧪 Testing Database Connection and Customer Creation');
    console.log('==================================================');
    
    try {
        // Test database connection
        console.log('1. Testing database connection...');
        const connected = await testConnection();
        if (!connected) {
            console.log('❌ Database connection failed');
            return;
        }
        console.log('✅ Database connected successfully');
        
        // Test customer creation
        console.log('2. Testing customer creation...');
        const testPhone = '48794740269';
        
        const result = await Customer.findOrCreate(testPhone);
        console.log('Customer creation result:', result);
        
        if (result.success) {
            console.log('✅ Customer creation successful');
            console.log('Customer data:', result.data);
        } else {
            console.log('❌ Customer creation failed:', result.error);
        }
        
        // Test direct database query
        console.log('3. Testing direct database query...');
        const queryResult = await executeQuery('SELECT COUNT(*) as count FROM customers');
        console.log('Customers count:', queryResult);
        
        // Test webhook logs
        console.log('4. Testing webhook logs...');
        const webhookResult = await executeQuery('SELECT COUNT(*) as count FROM webhook_logs');
        console.log('Webhook logs count:', webhookResult);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testDatabase();
