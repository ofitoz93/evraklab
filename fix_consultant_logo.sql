-- =============================================
-- FIX: Danışman logo URL sütununun organizations tablosuna eklenmesi
-- Bu SQL'i Supabase SQL Editor üzerinden çalıştırın.
-- =============================================

-- 1. consultant_logo_url sütununu ekle (zaten varsa atla)
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS consultant_logo_url TEXT;

-- 2. Doğrulama: Mevcut organizations tablosu yapısını görüntüle
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'organizations' 
ORDER BY ordinal_position;
