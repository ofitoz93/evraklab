-- ==========================================================
-- MÜŞTERİ, EVRAK TALEBİNİ KARŞILARKEN documents TABLOSUNA
-- EKLEME YAPABİLSİN
-- Var olan "Allow users to insert their own documents" policy'si
-- sadece organization_id = kullanıcının KENDİ profiles.organization_id'si
-- olduğunda izin veriyordu. Müşteri hesaplarının (role='client')
-- organization_id'si hep NULL'dur; belgeyi danışmanlık firmasının
-- organizasyonuna (consultant_company_id) kaydetmeleri gerekiyor.
-- Bu ek permissive policy, sadece kendi bağlı olduğu
-- consultant_clients kaydının consultant_company_id'sine belge
-- eklemesine izin verir.
-- ==========================================================

DROP POLICY IF EXISTS "Client can insert documents for consultant org" ON public.documents;
CREATE POLICY "Client can insert documents for consultant org" ON public.documents
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid()
    AND organization_id IN (
      SELECT cc.consultant_company_id
      FROM public.consultant_clients cc
      JOIN public.profiles p ON p.client_id = cc.id
      WHERE p.id = auth.uid()
    )
  );
