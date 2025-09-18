-- Sample Data for ticket_form_fields Table
-- This file contains sample form field definitions for all ticket types
-- Based on the current WhatsApp ticketing system logic

USE whatsapp_ticketing;

-- Clear existing data (optional - uncomment if you want to reset)
-- DELETE FROM ticket_form_fields;

-- Insert form field definitions for each ticket type
-- Lock Open fields
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('lock_open', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('lock_open', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('lock_open', 'location', 'Location', 'text', TRUE, '{"max_length": 255}', 3),
('lock_open', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 4);

-- Lock Repair fields
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('lock_repair', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('lock_repair', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('lock_repair', 'location', 'Location', 'text', TRUE, '{"max_length": 255}', 3),
('lock_repair', 'availability_date', 'Available Date', 'date', TRUE, NULL, 4),
('lock_repair', 'availability_time', 'Available Time', 'time', TRUE, NULL, 5),
('lock_repair', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 6);

-- Fund Request fields
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('fund_request', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('fund_request', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('fund_request', 'amount', 'Amount (₹)', 'number', TRUE, '{"max": 99999, "min": 1}', 3),
('fund_request', 'upi_id', 'UPI ID', 'text', TRUE, '{"max_length": 255}', 4),
('fund_request', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 5);

-- Fuel Request fields
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('fuel_request', 'fuel_type', 'Fuel Request Type', 'select', TRUE, '{"options": ["amount", "quantity"]}', 1),
('fuel_request', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 2),
('fuel_request', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 3),
('fuel_request', 'amount', 'Amount (₹)', 'number', FALSE, '{"max": 99999, "min": 1}', 4),
('fuel_request', 'quantity', 'Quantity (Liters)', 'number', FALSE, '{"max": 9999, "min": 1}', 5),
('fuel_request', 'upi_id', 'UPI ID', 'text', FALSE, '{"max_length": 255}', 6),
('fuel_request', 'comment', 'Comment', 'text', FALSE, '{"max_length": 500}', 7);

-- Other fields
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('other', 'comment', 'Please describe your issue', 'text', TRUE, '{"max_length": 500}', 1);

-- Additional sample fields for enhanced functionality
-- Emergency Lock Open (with priority)
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('emergency_lock_open', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('emergency_lock_open', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('emergency_lock_open', 'location', 'Exact Location', 'text', TRUE, '{"max_length": 255}', 3),
('emergency_lock_open', 'urgency_level', 'Urgency Level', 'select', TRUE, '{"options": ["high", "critical", "emergency"]}', 4),
('emergency_lock_open', 'contact_person', 'Emergency Contact Person', 'text', FALSE, '{"max_length": 100}', 5),
('emergency_lock_open', 'comment', 'Additional Details', 'text', FALSE, '{"max_length": 500}', 6);

-- Maintenance Request
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('maintenance', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('maintenance', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('maintenance', 'maintenance_type', 'Type of Maintenance', 'select', TRUE, '{"options": ["routine", "repair", "inspection", "cleaning"]}', 3),
('maintenance', 'location', 'Location', 'text', TRUE, '{"max_length": 255}', 4),
('maintenance', 'availability_date', 'Preferred Date', 'date', TRUE, NULL, 5),
('maintenance', 'availability_time', 'Preferred Time', 'time', TRUE, NULL, 6),
('maintenance', 'estimated_duration', 'Estimated Duration (hours)', 'number', FALSE, '{"max": 24, "min": 1}', 7),
('maintenance', 'comment', 'Description of Issue', 'text', TRUE, '{"max_length": 500}', 8);

-- Document Request
INSERT INTO ticket_form_fields (ticket_type, field_name, field_label, field_type, is_required, validation_rules, display_order) VALUES
('document_request', 'vehicle_number', 'Vehicle Number', 'text', TRUE, '{"max_length": 20}', 1),
('document_request', 'driver_number', 'Driver Number', 'text', TRUE, '{"max_length": 20}', 2),
('document_request', 'document_type', 'Document Type', 'select', TRUE, '{"options": ["registration", "insurance", "permit", "license", "other"]}', 3),
('document_request', 'purpose', 'Purpose of Request', 'text', TRUE, '{"max_length": 200}', 4),
('document_request', 'urgency', 'Urgency', 'select', TRUE, '{"options": ["low", "medium", "high", "urgent"]}', 5),
('document_request', 'comment', 'Additional Information', 'text', FALSE, '{"max_length": 500}', 6);

-- Verification queries to check the data
SELECT 'Form fields inserted successfully' as status;
SELECT ticket_type, COUNT(*) as field_count FROM ticket_form_fields GROUP BY ticket_type;
SELECT * FROM ticket_form_fields ORDER BY ticket_type, display_order;
