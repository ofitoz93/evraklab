-- ==========================================================
-- MÜŞTERİ KENDİ SAHA DENETİM FORMUNU OLUŞTURABİLSİN
-- create_inspection_module.sql'deki mevcut danışman/personel
-- policy'lerini bozmadan, müşteri (profiles.role='client') hesabına
-- kendi client_id'sine ait form/soru/nokta yönetimi izni ekler.
-- Postgres, aynı komut için birden fazla permissive policy'yi OR
-- mantığıyla birleştirdiğinden mevcut danışman erişimi etkilenmez.
-- ==========================================================

DROP POLICY IF EXISTS "Allow client to manage own forms" ON public.inspection_forms;
CREATE POLICY "Allow client to manage own forms" ON public.inspection_forms
  FOR ALL USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  )
  WITH CHECK (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  );

DROP POLICY IF EXISTS "Allow client to manage own questions" ON public.inspection_questions;
CREATE POLICY "Allow client to manage own questions" ON public.inspection_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.inspection_forms f
      WHERE f.id = form_id AND f.client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inspection_forms f
      WHERE f.id = form_id AND f.client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL))
  );

DROP POLICY IF EXISTS "Allow client to manage own points" ON public.inspection_points;
CREATE POLICY "Allow client to manage own points" ON public.inspection_points
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.inspection_forms f
      WHERE f.id = form_id AND f.client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.inspection_forms f
      WHERE f.id = form_id AND f.client_id IN (
        SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL))
  );
