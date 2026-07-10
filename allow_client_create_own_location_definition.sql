-- ==========================================================
-- MÜŞTERİ EVRAK TALEBİNİ KARŞILARKEN KENDİ FİRMA ETİKETİNİ
-- OLUŞTURABİLSİN
-- Belgenin "hangi firmaya ait" olduğu user_definitions (category='location')
-- tablosundaki etiketle belirleniyor; Zorunlu Belge Matrisi, Firma Bazlı
-- Kota ve müşterinin kendi "Belgelerim" sekmesi hep bu etikete bakıyor.
-- Bu policy olmadan müşteri (role='client') bu tabloya hiç INSERT
-- yapamıyordu, bu yüzden ClientPanel'den karşılanan talepler hiçbir
-- yerde firma bazında görünmüyordu. Sadece KENDİ firma adıyla, kendi
-- danışmanlık firmasının kapsamında bir etiket oluşturmasına izin verir.
-- ==========================================================

DROP POLICY IF EXISTS "Client can create own location definition" ON public.user_definitions;
CREATE POLICY "Client can create own location definition" ON public.user_definitions
  FOR INSERT WITH CHECK (
    category = 'location'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      JOIN public.consultant_clients cc ON cc.id = p.client_id
      WHERE p.id = auth.uid()
        AND cc.consultant_company_id = user_definitions.organization_id
        AND lower(trim(cc.name)) = lower(trim(user_definitions.label))
    )
  );
