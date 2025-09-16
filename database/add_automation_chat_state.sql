-- Add automation_chat_state field to conversation_states table
-- This field tracks the current automation state for conversation flow

USE whatsapp_ticketing;

-- Add automation_chat_state column to conversation_states table
ALTER TABLE conversation_states 
ADD COLUMN automation_chat_state VARCHAR(50) NULL COMMENT 'Current automation chat state for conversation flow';

-- Update the unique key to include the new field if needed
-- (The existing unique key should still work as it's on phone_number)
