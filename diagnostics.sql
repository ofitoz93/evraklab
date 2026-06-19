CREATE OR REPLACE FUNCTION public.get_diagnostics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'organizations', (SELECT COALESCE(json_agg(o), '[]'::json) FROM (SELECT id, name, is_environmental_consultant FROM public.organizations) o),
    'consultant_clients', (SELECT COALESCE(json_agg(cc), '[]'::json) FROM (SELECT id, name, consultant_company_id FROM public.consultant_clients) cc),
    'client_regulations', (SELECT COALESCE(json_agg(cr), '[]'::json) FROM (SELECT id, client_id, parent_regulation_id FROM public.client_regulations) cr),
    'profiles', (SELECT COALESCE(json_agg(p), '[]'::json) FROM (SELECT id, email, role, organization_id FROM public.profiles) p)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
