const TicketService = require('./services/ticketService');
const { executeQuery } = require('./config/database');

async function testMilestone1Flow() {
    console.log('🧪 Testing Milestone 1 Interactive Flow');
    console.log('=====================================');

    const ticketService = new TicketService();

    // Test scenarios
    const testScenarios = [
        {
            name: 'New User - Lock Open Request',
            phoneNumber: '919876543210',
            messages: [
                'Hello',
                '1', // Lock Open
                'ABC123', // Vehicle
                'XYZ789', // Driver
                'Mumbai', // Location
                'Need urgent help' // Comment
            ]
        },
        {
            name: 'Fuel Request by Amount',
            phoneNumber: '919876543211',
            messages: [
                'Hi',
                '4', // Fuel Request
                '1', // By Amount
                'DEF456', // Vehicle
                'PQR123', // Driver
                '500', // Amount
                'user@paytm', // UPI ID
                'Need fuel for long trip' // Comment
            ]
        },
        {
            name: 'Fund Request',
            phoneNumber: '919876543212',
            messages: [
                'Hello',
                '3', // Fund Request
                'GHI789', // Vehicle
                'STU456', // Driver
                '1000', // Amount
                'Need emergency funds', // Comment
                'user@phonepe' // UPI ID
            ]
        }
    ];

    for (const scenario of testScenarios) {
        console.log(`\n Testing: ${scenario.name}`);
        console.log('─'.repeat(50));

        for (let i = 0; i < scenario.messages.length; i++) {
            const message = scenario.messages[i];
            console.log(`\n👤 User: "${message}"`);

            const mockMessage = {
                id: `test_${Date.now()}_${i}`,
                from: scenario.phoneNumber,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: message
            };

            try {
                const result = await ticketService.processIncomingMessage(mockMessage);
                
                if (result.success) {
                    console.log(`✅ Bot: Success`);
                    if (result.whatsappResponse && result.whatsappResponse.data) {
                        console.log(`📱 Response: ${JSON.stringify(result.whatsappResponse.data, null, 2)}`);
                    }
                    if (result.ticket) {
                        console.log(`🎫 Ticket Created: ${result.ticket.ticket_number}`);
                    }
                    if (result.nextStep) {
                        console.log(`🔄 Next Step: ${result.nextStep}`);
                    }
                } else {
                    console.log(`❌ Error: ${result.error}`);
                }
            } catch (error) {
                console.log(` Exception: ${error.message}`);
            }

            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    console.log('\n🎉 Milestone 1 Flow Testing Completed!');
    console.log('\nCheck the database for created tickets and form states.');
}

// Run the test
if (require.main === module) {
    testMilestone1Flow().catch(console.error);
}

module.exports = testMilestone1Flow;