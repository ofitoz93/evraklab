-- Oylamaların (evaluations) silinebilmesi için RLS politikası ekleme.
-- Sadece Firma Sahibi/Yöneticiler kendi organizasyonundaki personelin oylamalarını silebilir.
CREATE POLICY "Only company owners/admins can delete evaluations" ON public.evaluations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
            AND p.role IN ('premium_corporate', 'admin', 'system_admin')
            AND p.organization_id = (
                SELECT organization_id FROM public.profiles WHERE id = evaluatee_id
            )
        )
    );
