-- Migration: Add acknowledgment field to messages table
-- This migration adds an acknowledged field to track whether messages have been viewed by counselors

-- Add acknowledged field to messages table
ALTER TABLE messages 
ADD COLUMN acknowledged BOOLEAN DEFAULT FALSE AFTER whatsapp_message_id,
ADD COLUMN acknowledged_at TIMESTAMP NULL AFTER acknowledged,
ADD COLUMN acknowledged_by INT NULL AFTER acknowledged_at;

-- Add foreign key constraint for acknowledged_by
ALTER TABLE messages 
ADD CONSTRAINT fk_messages_acknowledged_by 
FOREIGN KEY (acknowledged_by) REFERENCES users(id) ON DELETE SET NULL;

-- Add index for better performance on acknowledgment queries
CREATE INDEX idx_messages_acknowledged ON messages(acknowledged);
CREATE INDEX idx_messages_phone_acknowledged ON messages(phone_number, acknowledged);
