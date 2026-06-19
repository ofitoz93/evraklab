-- =============================================
-- Organizations tablosuna iletişim ve logo alanları ekle
-- Supabase SQL Editor'de çalıştırın
-- =============================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;
