-- "Modül Ayarları" sayfasında sadece ANA KATEGORİ anahtarları (operations,
-- compliance, documents, hr...) kayıtlıydı; kategorinin içindeki VARSAYILAN
-- alt modüller (clients, reports, legislations, team, actions, requests,
-- document_matrix, document_requests, definitions, terminated_clients,
-- org_chart, departed) hiç eklenmemişti. isModuleEnabled() bir alt modülün
-- kendi key'inin enabled_modules dizisinde AYRICA bulunmasını şart koştuğu
-- için, bu eksik kayıt "Tüm Şirketlere Toplu Uygula" ile veya ilk kurulumda
-- tüm şirketlerin enabled_modules alanına kopyalanmış, İşletmeler/Raporlar/
-- Mevzuat/Ekip gibi temel sayfaların erişim kontrolünü bozmuştu (admin/
-- system_admin rolü için isModuleEnabled() zaten her zaman true döndüğü için
-- bu, admin hesabıyla test ederken fark edilmiyordu).
--
-- Var olan (msds, finance gibi bilerek eklenmiş ekstra) anahtarları koruyarak
-- eksik varsayılan anahtarları geri ekliyoruz (birleşim/union, üzerine yazma
-- değil).

UPDATE public.pricing_settings
SET value = (
  SELECT jsonb_agg(DISTINCT k)
  FROM jsonb_array_elements_text(
    value || '["operations","compliance","documents","hr","finance","clients","terminated_clients","legislations","requests","actions","reports","document_matrix","document_requests","definitions","team","org_chart","departed"]'::jsonb
  ) AS k
)
WHERE key = 'default_system_modules';

UPDATE public.organizations
SET enabled_modules = (
  SELECT jsonb_agg(DISTINCT k)
  FROM jsonb_array_elements_text(
    COALESCE(enabled_modules, '[]'::jsonb) || '["operations","compliance","documents","hr","finance","clients","terminated_clients","legislations","requests","actions","reports","document_matrix","document_requests","definitions","team","org_chart","departed"]'::jsonb
  ) AS k
);
