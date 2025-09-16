-- Milestone 1: Interactive Form Flow Migration - Version 2
-- Fix the messages table to allow NULL ticket_id for initial messages

-- First, add new columns to tickets table
ALTER TABLE tickets 
ADD COLUMN amount DECIMAL(10,2) NULL COMMENT 'Amount for fund/fuel requests',
ADD COLUMN quantity INT NULL COMMENT 'Quantity for fuel requests',
ADD COLUMN upi_id VARCHAR(100) NULL COMMENT 'UPI ID for fund/fuel requests';

-- Update issue_type enum to include new types
ALTER TABLE tickets 
MODIFY COLUMN issue_type ENUM('lock_open', 'lock_repair', 'fund_request', 'fuel_request', 'other') NOT NULL;

-- Fix messages table to allow NULL ticket_id for initial messages
ALTER TABLE messages 
MODIFY COLUMN ticket_id INT NULL COMMENT 'Can be NULL for initial messages before ticket creation';

-- Create user session states table for form flow tracking
CREATE TABLE IF NOT EXISTS user_form_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    customer_id INT NOT NULL,
    current_step ENUM('initial', 'category_selected', 'vehicle_number', 'driver_number', 'location', 'amount', 'quantity', 'upi_id', 'availability_date', 'availability_time', 'comment', 'completed') NOT NULL,
    selected_category ENUM('lock_open', 'lock_repair', 'fund_request', 'fuel_request', 'other') NULL,
    fuel_request_type ENUM('amount', 'quantity') NULL COMMENT 'For fuel requests: by amount or quantity',
    form_data JSON NULL COMMENT 'Stores collected form data',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    UNIQUE KEY unique_customer_state (customer_id)
);

-- Add indexes for better performance
CREATE INDEX idx_user_form_states_customer_id ON user_form_states(customer_id);
CREATE INDEX idx_user_form_states_current_step ON user_form_states(current_step);