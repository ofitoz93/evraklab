-- ==========================================================
-- DEPO KOTASI DETAY GÖRÜNÜMÜ VE BELGE SİLME
-- 1) Hizmet verilen işletme (consultant_clients) bazında depolama
--    kullanımı raporu.
-- 2) Firma sahibi/yöneticinin, billing_org_id ile firma kotasına
--    bağlı ŞAHSİ belgeleri (organization_id NULL) de görüp
--    silebilmesi için documents SELECT/DELETE policy'lerini genişletir.
--    (add_documents_billing_org_id.sql'deki INSERT policy'sinden
--    sonra eklenen, kalan SELECT/DELETE tarafını tamamlayan migration.)
-- ==========================================================

CREATE OR REPLACE FUNCTION public.get_org_storage_usage_by_client(org_id UUID)
RETURNS TABLE(client_id UUID, client_name TEXT, total_bytes BIGINT, doc_count BIGINT) AS $$
  SELECT cc.id AS client_id,
         cc.name AS client_name,
         COALESCE(SUM(d.file_size), 0)::BIGINT AS total_bytes,
         COUNT(d.id)::BIGINT AS doc_count
  FROM public.consultant_clients cc
  JOIN public.user_definitions ud
    ON ud.organization_id = org_id
   AND ud.category = 'location'
   AND lower(trim(ud.label)) = lower(trim(cc.name))
  JOIN public.documents d
    ON d.location_def_id = ud.id
   AND (d.organization_id = org_id OR d.billing_org_id = org_id)
  WHERE cc.consultant_company_id = org_id
  GROUP BY cc.id, cc.name
  ORDER BY total_bytes DESC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Allow users to view documents" ON public.documents;
CREATE POLICY "Allow users to view documents" ON public.documents
  FOR SELECT USING (
    (uploader_id = auth.uid())
    OR (
      (organization_id IS NOT NULL)
      AND (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
      AND (
        ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['premium_corporate', 'corporate_chief', 'admin', 'system_admin', 'normal']))
        OR ((SELECT COALESCE((profiles.permissions ->> 'can_view_team_docs')::boolean, false) FROM public.profiles WHERE profiles.id = auth.uid()) = true)
        OR ((SELECT COALESCE((profiles.extra_permissions ->> 'can_view_all_clients')::boolean, false) FROM public.profiles WHERE profiles.id = auth.uid()) = true)
      )
    )
    OR (
      (billing_org_id IS NOT NULL)
      AND (billing_org_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
      AND ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['premium_corporate', 'corporate_chief', 'admin', 'system_admin']))
    )
  );

DROP POLICY IF EXISTS "Allow users to delete their own documents" ON public.documents;
CREATE POLICY "Allow users to delete their own documents" ON public.documents
  FOR DELETE USING (
    (uploader_id = auth.uid())
    OR (
      (organization_id IS NOT NULL)
      AND (organization_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
      AND (
        ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['premium_corporate', 'corporate_chief', 'admin', 'system_admin']))
        OR ((SELECT COALESCE((profiles.permissions ->> 'can_delete_team_docs')::boolean, false) FROM public.profiles WHERE profiles.id = auth.uid()) = true)
      )
    )
    OR (
      (billing_org_id IS NOT NULL)
      AND (billing_org_id = (SELECT profiles.organization_id FROM public.profiles WHERE profiles.id = auth.uid()))
      AND ((SELECT profiles.role FROM public.profiles WHERE profiles.id = auth.uid()) = ANY (ARRAY['premium_corporate', 'corporate_chief', 'admin', 'system_admin']))
    )
  );
