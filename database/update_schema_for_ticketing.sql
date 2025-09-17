-- Update database schema for comprehensive ticketing system
-- This script adds new tables and modifies existing ones

USE whatsapp_ticketing;

-- Add new columns to tickets table for the new ticket types
ALTER TABLE tickets 
ADD COLUMN IF NOT EXISTS amount DECIMAL(10,2) NULL,
ADD COLUMN IF NOT EXISTS upi_id VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS quantity INT NULL,
ADD COLUMN IF NOT EXISTS fuel_type ENUM('amount', 'quantity') NULL;

-- Update issue_type enum to include new ticket types
ALTER TABLE tickets 
MODIFY COLUMN issue_type ENUM(
    'lock_open', 
    'lock_repair', 
    'fund_request', 
    'fuel_request', 
    'other'
) NOT NULL;

-- Create conversation_states table to track user form progress
CREATE TABLE IF NOT EXISTS conversation_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) NOT NULL,
    current_step VARCHAR(50) NOT NULL,
    ticket_type VARCHAR(50) NULL,
    form_data JSON NULL,
    current_ticket_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    UNIQUE KEY unique_phone_state (phone_number)
);

-- Create ticket_form_fields table to track form field requirements
CREATE TABLE IF NOT EXISTS ticket_form_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(50) NOT NULL,
    field_label VARCHAR(100) NOT NULL,
    field_type ENUM('text', 'number', 'date', 'time', 'select') NOT NULL,
    is_required BOOLEAN DEFAULT TRUE,
    validation_rules JSON NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -- Insert form field definitions for each ticket type
-- INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
-- -- Lock Open fields
-- ('lock_open', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
-- ('lock_open', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
-- ('lock_open', 'location', 'Location', 'text', TRUE, '{"max_length": 255}', 3),
-- ('lock_open', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 4),

-- -- Lock Repair fields
-- ('lock_repair', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
-- ('lock_repair', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
-- ('lock_repair', 'location', 'Location', 'text', TRUE, '{"max_length": 255}', 3),
-- ('lock_repair', 'availability_date', 'Available Date', 'date', TRUE, NULL, 4),
-- ('lock_repair', 'availability_time', 'Available Time', 'time', TRUE, NULL, 5),
-- ('lock_repair', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 6),

-- -- Fund Request fields
-- ('fund_request', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
-- ('fund_request', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
-- ('fund_request', 'amount', 'Amount', 'number', TRUE, '{"max": 99999, "min": 1}', 3),
-- ('fund_request', 'upi_id', 'UPI ID', 'text', TRUE, '{"max_length": 255}', 4),
-- ('fund_request', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 5),

-- -- Fuel Request fields
-- ('fuel_request', 'fuel_type', 'Fuel Type', 'select', TRUE, '{"options": ["amount", "quantity"]}', 1),
-- ('fuel_request', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 2),
-- ('fuel_request', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 3),
-- ('fuel_request', 'amount', 'Amount', 'number', FALSE, '{"max": 99999, "min": 1}', 4),
-- ('fuel_request', 'quantity', 'Quantity', 'number', FALSE, '{"max": 9999, "min": 1}', 5),
-- ('fuel_request', 'upi_id', 'UPI ID', 'text', FALSE, '{"max_length": 255}', 6),
-- ('fuel_request', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 7),

-- -- Other fields
-- ('other', 'comment', 'Comment', 'text', TRUE, '{"max_length": 500}', 1);

-- -- Update existing tickets to have proper issue_type values
-- UPDATE tickets SET issue_type = 'other' WHERE issue_type = 'vehicle_status';

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_conversation_states_phone ON conversation_states(phone_number);
CREATE INDEX IF NOT EXISTS idx_conversation_states_step ON conversation_states(current_step);
CREATE INDEX IF NOT EXISTS idx_ticket_form_fields_type ON ticket_form_fields(ticket_type);
CREATE INDEX IF NOT EXISTS idx_tickets_issue_type ON tickets(issue_type);
