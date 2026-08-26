-- 2026-08-19'da AdminPanel > Modül Ayarları > Sistem Varsayılan Modülleri
-- üzerinden kaydedilen pricing_settings.default_system_modules listesi eksikti
-- ('legislations', 'requests', 'document_requests', 'org_chart', 'departed'
-- anahtarları yoktu) ve normalde ekstra/ücretli olan 'opinions'ı hatalıca
-- varsayılan olarak içeriyordu. Bu liste "Tüm Şirketlere Uygula" ile en az
-- bir kez çalıştırılmış ve 15 şirketin organizations.enabled_modules alanını
-- bu eksik listeyle ezmişti — etkilenen şirketlerde "Yasal Uyum & Takip"
-- (Mevzuat Takip/Talepleri) sekmesi ya hiç görünmüyor ya da tıklanınca
-- ConsultantPanel/CompanyPanel'deki güvenlik yönlendirmesi yüzünden başka bir
-- sekmeye atıyordu.
--
-- 1) Sistem varsayılan listesini moduleRegistry.ts > DEFAULT_MODULE_KEYS ile
--    eşleşecek şekilde düzeltir (gelecekte tekrar "Tüm Şirketlere Uygula"
--    çalıştırılırsa doğru liste uygulanır).
UPDATE public.pricing_settings
SET value = '["operations","compliance","documents","finance","hr","clients","terminated_clients","legislations","requests","reports","document_matrix","document_requests","definitions","team","org_chart","departed"]'::jsonb,
    updated_at = NOW()
WHERE key = 'default_system_modules';

-- 2) Etkilenen şirketlerin enabled_modules alanına eksik varsayılan
--    anahtarları GERİ EKLER (mevcut anahtarlar korunur, hiçbir şey silinmez).
--    Hangi şirketlerin etkilendiğini önce kontrol edin:
--      SELECT id, name, enabled_modules FROM public.organizations
--      WHERE enabled_modules IS NOT NULL AND jsonb_array_length(enabled_modules) > 0
--        AND NOT (enabled_modules ? 'legislations');
--    Aşağıdaki UPDATE, TÜM etkilenen şirketlere toplu uygulanacaksa
--    kullanılabilir (production'da manuel onay sonrası çalıştırın):
UPDATE public.organizations
SET enabled_modules = (
  SELECT jsonb_agg(DISTINCT k)
  FROM jsonb_array_elements_text(
    COALESCE(enabled_modules, '[]'::jsonb) || '["legislations","requests","document_requests","org_chart","departed"]'::jsonb
  ) AS k
)
WHERE enabled_modules IS NOT NULL
  AND jsonb_array_length(enabled_modules) > 0
  AND NOT (enabled_modules ? 'legislations');
