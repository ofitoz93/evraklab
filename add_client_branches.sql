-- "Hizmet Verilen İşletmeler" panelinde bir firmaya şube ekleyebilmek için:
-- bir şube, ana firmaya parent_client_id ile bağlı, consultant_clients
-- tablosunda ayrı bir satırdır (ör. "CAN VARİL" -> "CAN VARİL Atölye Şube").
--
-- Şubeler normal bir işletme gibi çalışır: kendi personel atamaları
-- (consultant_assignments), kendi belgeleri (documents) olabilir ve
-- atanan personelin belge yükleme ekranındaki "Lokasyon" listesinde
-- otomatik olarak görünür (bkz. AddDocument.tsx / EditDocument.tsx
-- fetchCorporateClients + getFilteredLocOptions - ek bir kod değişikliği
-- gerektirmez, çünkü zaten consultant_clients tablosundaki her satırı
-- kullanıyor).
--
-- RLS tarafında değişiklik gerekmiyor: mevcut politikalar
-- consultant_company_id üzerinden çalışıyor ve şubeler ana firmayla
-- aynı consultant_company_id'yi paylaşıyor.

ALTER TABLE public.consultant_clients
  ADD COLUMN IF NOT EXISTS parent_client_id UUID REFERENCES public.consultant_clients(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_consultant_clients_parent_client_id
  ON public.consultant_clients(parent_client_id);
