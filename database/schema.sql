-- WhatsApp Ticketing System Database Schema
-- Create database
CREATE DATABASE IF NOT EXISTS whatsapp_ticketing;
USE whatsapp_ticketing;

-- Users table (agents and seniors)
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    role ENUM('agent', 'senior', 'admin') DEFAULT 'agent',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Customers table (WhatsApp users)
CREATE TABLE IF NOT EXISTS customers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_number VARCHAR(50) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    assigned_agent_id INT,
    status ENUM('open', 'in_progress', 'pending_customer', 'closed') DEFAULT 'open',
    priority ENUM('low', 'medium', 'high', 'urgent') DEFAULT 'medium',
    issue_type ENUM('lock_open', 'repair', 'vehicle_status', 'other') NOT NULL,
    vehicle_number VARCHAR(50),
    driver_number VARCHAR(50),
    location TEXT,
    availability_date DATE,
    availability_time TIME,
    comment TEXT,
    escalation_time TIMESTAMP NULL,
    escalated_to_senior_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_agent_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (escalated_to_senior_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    sender_type ENUM('customer', 'agent', 'system') NOT NULL,
    sender_id INT,
    message_text TEXT NOT NULL,
    message_type ENUM('text', 'image', 'document', 'template') DEFAULT 'text',
    media_url VARCHAR(500),
    is_from_whatsapp BOOLEAN DEFAULT FALSE,
    whatsapp_message_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Ticket escalations table
CREATE TABLE IF NOT EXISTS ticket_escalations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_id INT NOT NULL,
    escalated_from_agent_id INT NOT NULL,
    escalated_to_senior_id INT NOT NULL,
    escalation_reason TEXT,
    escalation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status ENUM('pending', 'acknowledged', 'resolved') DEFAULT 'pending',
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
    FOREIGN KEY (escalated_from_agent_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (escalated_to_senior_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Webhook logs table
CREATE TABLE IF NOT EXISTS webhook_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    webhook_data JSON,
    processed BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned_agent ON tickets(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_ticket_id ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone_number);

-- Insert sample data (ignore duplicates)
INSERT IGNORE INTO users (name, email, role) VALUES 
('Admin User', 'admin@company.com', 'admin'),
('Senior Agent 1', 'senior1@company.com', 'senior'),
('Agent 1', 'agent1@company.com', 'agent'),
('Agent 2', 'agent2@company.com', 'agent');
