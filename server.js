const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

// Import configurations and services
const { testConnection } = require('./config/database');
const webhookRoutes = require('./routes/webhook');
const ticketRoutes = require('./routes/tickets');
const SocketService = require('./services/socketService');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from React build
app.use(express.static(path.join(__dirname, './build')));

// Routes
app.use('/webhook', webhookRoutes);
app.use('/enhanced-webhook', require('./routes/enhancedWebhook'));
app.use('/socket-webhook', require('./routes/socketWebhook'));
app.use('/api/tickets', ticketRoutes);
app.use('/api/customers', require('./routes/customers'));

// Serve React app for all non-API routes (only if build exists)
app.get('*', (req, res) => {
    const buildPath = path.join(__dirname, './build', 'index.html');
    const fs = require('fs');
    
    if (fs.existsSync(buildPath)) {
        res.sendFile(buildPath);
    } else {
        res.status(200).json({
            message: 'WhatsApp Ticketing System API',
            status: 'running',
            note: 'Client build not found. Run "npm run build" in client directory to build the dashboard.',
            endpoints: {
                webhook: '/webhook',
                tickets: '/api/tickets',
                health: '/health'
            }
        });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'WhatsApp Ticketing System',
        version: '1.0.0'
    });
});

// API documentation endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'WhatsApp Ticketing System API',
        version: '1.0.0',
        description: 'Real-time ticketing system with WhatsApp integration',
        endpoints: {
            webhook: {
                'GET /webhook': 'Webhook verification',
                'POST /webhook': 'Receive WhatsApp messages',
                'POST /webhook/test-message': 'Send test message',
                'GET /webhook/webhook-logs': 'Get webhook logs',
                'GET /webhook/health': 'Health check'
            },
            tickets: {
                'GET /api/tickets': 'Get all tickets',
                'GET /api/tickets/:id': 'Get ticket by ID',
                'GET /api/tickets/customer/:phoneNumber': 'Get tickets by customer phone',
                'POST /api/tickets': 'Create new ticket',
                'PATCH /api/tickets/:id/status': 'Update ticket status',
                'PATCH /api/tickets/:id/assign': 'Assign ticket to agent',
                'POST /api/tickets/:id/reply': 'Send agent reply',
                'GET /api/tickets/:id/messages': 'Get ticket messages',
                'PATCH /api/tickets/:id/close': 'Close ticket',
                'GET /api/tickets/escalations/check': 'Check escalations'
            }
        }
    });
});

// Initialize Socket Service
const socketService = new SocketService(io);

// Make io and socketService available to other modules
app.set('io', io);
app.set('socketService', socketService);

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
        success: false,
        error: 'Internal server error',
        message: err.message
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.path
    });
});

// Start server
const PORT = process.env.PORT || 4000;

async function startServer() {
    try {
        // Test database connection
        const dbConnected = await testConnection();
        
        if (!dbConnected) {
            console.error('❌ Failed to connect to database. Please check your configuration.');
            process.exit(1);
        }

        // Start HTTP server
        server.listen(PORT, () => {
            console.log('🚀 WhatsApp Ticketing System Server Started');
            console.log('=====================================');
            console.log(`📡 Server running on port ${PORT}`);
            console.log(`🌐 Dashboard: http://localhost:3000`);
            console.log(`📋 API Documentation: http://localhost:${PORT}/api`);
            console.log(`🔗 Webhook URL: http://localhost:${PORT}/webhook`);
            console.log(`💚 Health Check: http://localhost:${PORT}/health`);
            console.log('=====================================');
            console.log('📱 WhatsApp Integration Ready');
            console.log('🎫 Ticket System Active');
            console.log('⚡ Real-time Updates Enabled');
            console.log('=====================================');
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received, shutting down gracefully');
    server.close(() => {
        console.log('✅ Process terminated');
        process.exit(0);
    });
});

// Start the server
startServer();
