-- client_regulations (bir mevzuatın bir işletmeye/lokasyona atanması):
-- MANAGE/SELECT politikaları sadece 'premium_corporate' rolünü veya
-- işletme adı ile organizasyon adının BİREBİR aynı olmasını kabul
-- ediyordu. Bireysel premium hesaplarda organizasyon adı kullanıcının
-- kendi adı, lokasyon/firma kaydı ise kasıtlı olarak "Lokasyon 1" gibi
-- farklı bir isim taşıdığı için (bkz. fix_premium_individual_round2.sql),
-- bu isim eşleşmesi hiçbir zaman sağlanmıyordu ve 'premium_individual'
-- rolü de listede yoktu - bu yüzden "mevzuatı lokasyona ata" işlemi RLS
-- tarafından sessizce engelleniyordu.

DROP POLICY IF EXISTS "Select client_regulations" ON public.client_regulations;
CREATE POLICY "Select client_regulations" ON public.client_regulations
    FOR SELECT TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR p.role = 'premium_individual' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND (
                LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
                OR LOWER(TRIM(cc.name)) LIKE '%' || LOWER(TRIM(o.name)) || '%'
                OR LOWER(TRIM(o.name)) LIKE '%' || LOWER(TRIM(cc.name)) || '%'
              )
        )
    );

DROP POLICY IF EXISTS "Manage client_regulations" ON public.client_regulations;
CREATE POLICY "Manage client_regulations" ON public.client_regulations
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin')) OR
        EXISTS (
            SELECT 1 FROM public.profiles p
            JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
            WHERE p.id = auth.uid()
              AND (p.role = 'premium_corporate' OR p.role = 'premium_individual' OR (p.permissions->>'can_view_all_clients')::boolean = true)
              AND cc.id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_assignments ca
            WHERE ca.user_id = auth.uid()
              AND ca.client_id = client_regulations.client_id
        ) OR
        EXISTS (
            SELECT 1 FROM public.consultant_clients cc
            JOIN public.profiles p ON p.id = auth.uid()
            JOIN public.organizations o ON o.id = p.organization_id
            WHERE cc.id = client_regulations.client_id
              AND LOWER(TRIM(cc.name)) = LOWER(TRIM(o.name))
        )
    );
