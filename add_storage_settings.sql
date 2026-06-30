-- Alter organizations table to add storage preference columns
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS storage_preference VARCHAR(50) DEFAULT 'supabase';
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_client_id TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_client_secret TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_drive_folder_id VARCHAR(255);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_drive_access_token TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_drive_refresh_token TEXT;
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS google_drive_connected_email VARCHAR(255);

COMMENT ON COLUMN organizations.storage_preference IS 'Choices: supabase, google_drive';
COMMENT ON COLUMN organizations.google_drive_folder_id IS 'Specific target folder ID in the user s Google Drive';
