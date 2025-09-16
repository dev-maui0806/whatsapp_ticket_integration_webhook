const { io } = require('socket.io-client');

// Test Socket.IO communication
async function testSocketCommunication() {
    console.log('🧪 Testing Socket.IO Communication...\n');

    // Test customer connection
    console.log('1. Testing Customer Connection...');
    const customerSocket = io('http://localhost:4000');
    
    customerSocket.on('connect', () => {
        console.log('✅ Customer socket connected');
        
        // Connect as customer
        customerSocket.emit('customerConnect', {
            phoneNumber: '9876543210',
            customerName: 'Test Customer'
        });
    });

    customerSocket.on('customerConnected', (data) => {
        console.log('✅ Customer connected successfully:', data);
        
        // Send a test message
        setTimeout(() => {
            console.log('📤 Sending test message...');
            customerSocket.emit('customerMessage', {
                messageText: 'Hello, I need help with my vehicle',
                messageType: 'text'
            });
        }, 1000);
    });

    customerSocket.on('interactiveMessage', (data) => {
        console.log('✅ Received interactive message:', data);
        
        // Respond to interactive message
        setTimeout(() => {
            console.log('📤 Responding to interactive message...');
            customerSocket.emit('interactiveResponse', {
                buttonId: 'lock_open',
                buttonTitle: 'Lock Open'
            });
        }, 1000);
    });

    customerSocket.on('formStep', (data) => {
        console.log('✅ Received form step:', data);
        
        // Complete form step
        setTimeout(() => {
            console.log('📤 Completing form step...');
            customerSocket.emit('formStepComplete', {
                step: data.step,
                stepData: {
                    vehicle_number: 'ABC123',
                    driver_number: 'XYZ789',
                    location: 'Warsaw'
                }
            });
        }, 1000);
    });

    customerSocket.on('ticketCreated', (data) => {
        console.log('✅ Ticket created successfully:', data);
        
        // Test agent connection
        setTimeout(() => {
            testAgentConnection();
        }, 1000);
    });

    customerSocket.on('error', (error) => {
        console.error('❌ Customer socket error:', error);
    });

    // Test agent connection
    function testAgentConnection() {
        console.log('\n2. Testing Agent Connection...');
        const agentSocket = io('http://localhost:4000');
        
        agentSocket.on('connect', () => {
            console.log('✅ Agent socket connected');
            
            // Connect as agent
            agentSocket.emit('agentConnect', {
                agentId: 1,
                agentName: 'Test Agent'
            });
        });

        agentSocket.on('agentConnected', (data) => {
            console.log('✅ Agent connected successfully:', data);
            
            // Send agent message
            setTimeout(() => {
                console.log('📤 Sending agent message...');
                agentSocket.emit('agentMessage', {
                    ticketId: 1, // Assuming ticket ID 1 exists
                    messageText: 'Hello! I\'m here to help you with your vehicle issue.'
                });
            }, 1000);
        });

        agentSocket.on('newCustomerMessage', (data) => {
            console.log('✅ Received new customer message:', data);
        });

        agentSocket.on('messageSent', (data) => {
            console.log('✅ Agent message sent successfully:', data);
            
            // Test agent action
            setTimeout(() => {
                console.log('📤 Testing agent action...');
                agentSocket.emit('agentAction', {
                    action: 'assign',
                    ticketId: 1,
                    data: { agentId: 1 }
                });
            }, 1000);
        });

        agentSocket.on('agentActionCompleted', (data) => {
            console.log('✅ Agent action completed:', data);
            
            // Close sockets
            setTimeout(() => {
                console.log('\n🏁 Test completed successfully!');
                customerSocket.disconnect();
                agentSocket.disconnect();
                process.exit(0);
            }, 1000);
        });

        agentSocket.on('error', (error) => {
            console.error('❌ Agent socket error:', error);
        });
    }

    // Handle connection errors
    customerSocket.on('connect_error', (error) => {
        console.error('❌ Customer connection error:', error.message);
        console.log('💡 Make sure the server is running on port 4000');
        process.exit(1);
    });
}

// Run the test
if (require.main === module) {
    testSocketCommunication().catch(console.error);
}

module.exports = { testSocketCommunication };
