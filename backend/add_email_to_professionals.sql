-- Add email column to professionals table
ALTER TABLE professionals ADD COLUMN IF NOT EXISTS email TEXT;
