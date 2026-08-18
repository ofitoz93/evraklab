-- ==========================================================
-- DİNAMİK MODÜL YÖNETİMİ VE İZİNLERİ (organizations.enabled_modules)
-- Admin tarafından her şirkete/organizasyona tanımlanabilir
-- varsayılan ve ekstra/opsiyonel modül anahtarlarını saklar.
-- ==========================================================

ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS enabled_modules JSONB 
DEFAULT '["operations", "compliance", "documents", "hr", "clients", "terminated_clients", "legislations", "requests", "actions", "reports", "document_matrix", "document_requests", "definitions", "team", "org_chart", "departed"]'::jsonb;

-- Var olan ancak enabled_modules alanı NULL olan organizasyonlara varsayılan modülleri atayalım
UPDATE public.organizations
SET enabled_modules = '["operations", "compliance", "documents", "hr", "clients", "terminated_clients", "legislations", "requests", "actions", "reports", "document_matrix", "document_requests", "definitions", "team", "org_chart", "departed"]'::jsonb
WHERE enabled_modules IS NULL;
