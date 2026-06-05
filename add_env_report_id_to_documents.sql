-- documents tablosuna env_report_id kolonu ekle (önceki migration)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS env_report_id UUID REFERENCES env_reports(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_env_report_id ON documents(env_report_id);

-- env_reports tablosuna ıslak imza alanları ekle
ALTER TABLE env_reports ADD COLUMN IF NOT EXISTS wet_signature_url TEXT;
ALTER TABLE env_reports ADD COLUMN IF NOT EXISTS wet_signed_at TIMESTAMP WITH TIME ZONE;
