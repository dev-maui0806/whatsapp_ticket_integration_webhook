-- Migration to support phone number-based chat
-- Add phone_number field to messages table
ALTER TABLE messages ADD COLUMN phone_number VARCHAR(20) AFTER ticket_id;

-- Add index for phone_number for better performance
CREATE INDEX idx_messages_phone_number ON messages(phone_number);

-- Update existing messages to have phone_number from customers table
UPDATE messages m 
JOIN tickets t ON m.ticket_id = t.id 
JOIN customers c ON t.customer_id = c.id 
SET m.phone_number = c.phone_number 
WHERE m.phone_number IS NULL;

-- Add new table for customer chat sessions (to track active chats)
CREATE TABLE IF NOT EXISTS customer_chat_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) NOT NULL,
    customer_id INT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
    INDEX idx_phone_number (phone_number),
    INDEX idx_is_active (is_active),
    INDEX idx_last_message_at (last_message_at)
);

-- Add table for bot conversation states (replacing conversation_states)
CREATE TABLE IF NOT EXISTS bot_conversation_states (
    id INT PRIMARY KEY AUTO_INCREMENT,
    phone_number VARCHAR(20) NOT NULL,
    current_step VARCHAR(50),
    ticket_type VARCHAR(50),
    form_data JSON,
    current_ticket_id INT,
    automation_chat_state VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (current_ticket_id) REFERENCES tickets(id) ON DELETE SET NULL,
    UNIQUE KEY unique_phone (phone_number),
    INDEX idx_phone_number (phone_number),
    INDEX idx_current_step (current_step),
    INDEX idx_automation_chat_state (automation_chat_state)
);

-- Add table for ticket form fields (if not exists)
CREATE TABLE IF NOT EXISTS ticket_form_fields (
    id INT PRIMARY KEY AUTO_INCREMENT,
    ticket_type VARCHAR(50) NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    field_label VARCHAR(200) NOT NULL,
    field_type VARCHAR(50) DEFAULT 'text',
    is_required BOOLEAN DEFAULT FALSE,
    validation_rules JSON,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ticket_type (ticket_type),
    INDEX idx_display_order (display_order)
);

-- Insert sample ticket form fields
INSERT IGNORE INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, display_order) VALUES
('lock_open', 'vehicle_number', 'Vehicle Number', 'text', TRUE, 1),
('lock_open', 'driver_number', 'Driver Number', 'text', TRUE, 2),
('lock_open', 'location', 'Location', 'text', TRUE, 3),
('lock_open', 'comment', 'Additional Comments', 'textarea', FALSE, 4),

('lock_repair', 'vehicle_number', 'Vehicle Number', 'text', TRUE, 1),
('lock_repair', 'driver_number', 'Driver Number', 'text', TRUE, 2),
('lock_repair', 'location', 'Location', 'text', TRUE, 3),
('lock_repair', 'comment', 'Repair Details', 'textarea', TRUE, 4),

('fund_request', 'amount', 'Amount', 'number', TRUE, 1),
('fund_request', 'upi_id', 'UPI ID', 'text', TRUE, 2),
('fund_request', 'comment', 'Purpose', 'textarea', TRUE, 3),

('fuel_request', 'fuel_type', 'Fuel Type', 'select', TRUE, 1),
('fuel_request', 'quantity', 'Quantity (Liters)', 'number', TRUE, 2),
('fuel_request', 'location', 'Location', 'text', TRUE, 3),
('fuel_request', 'comment', 'Additional Details', 'textarea', FALSE, 4),

('other', 'comment', 'Description', 'textarea', TRUE, 1);
