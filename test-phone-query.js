const Message = require('./models/Message');

async function testPhoneQuery() {
    console.log('🧪 Testing Phone Number Query\n');
    
    try {
        const testPhone = '48794740269';
        
        console.log(`1️⃣ Testing query for phone: ${testPhone}`);
        console.log('Query: SELECT m.*, m.sender_type FROM messages m WHERE m.phone_number = ? ORDER BY m.created_at ASC LIMIT ? OFFSET ?');
        console.log('Parameters:', [testPhone, 50, 0]);
        
        const result = await Message.getByPhoneNumber(testPhone, 50, 0);
        
        if (result.success) {
            const messages = result.data;
            console.log(`✅ Query successful! Found ${messages.length} messages:`);
            
            if (messages.length > 0) {
                messages.forEach((msg, index) => {
                    console.log(`   ${index + 1}. ID: ${msg.id}, Sender: ${msg.sender_type}, Text: ${(msg.message_text || '').substring(0, 50)}...`);
                });
            } else {
                console.log('   No messages found for this phone number.');
            }
        } else {
            console.log('❌ Query failed:', result.error);
        }
        
        // Test with different phone number
        console.log('\n2️⃣ Testing with different phone number...');
        const testPhone2 = '1234567890';
        const result2 = await Message.getByPhoneNumber(testPhone2, 10, 0);
        
        if (result2.success) {
            console.log(`✅ Query successful! Found ${result2.data.length} messages for ${testPhone2}`);
        } else {
            console.log('❌ Query failed:', result2.error);
        }
        
        console.log('\n🎉 Phone number query test completed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Run the test
testPhoneQuery();
