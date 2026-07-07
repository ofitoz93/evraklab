-- ==========================================================
-- GOOGLE DRIVE AYARLARINI SADECE ADMİN DEĞİŞTİREBİLSİN
--
-- "FİTOZ A.Ş." organizasyonunda storage_preference='google_drive'
-- olarak ayarlanmıştı ama google_drive_connected_email boştu (yani
-- bağlantı hiç tamamlanmamıştı) - bu yüzden her belge yüklemesinde
-- "Google access token yenilenemedi" hatası alınıyordu. Uygulamada bu
-- alanları yazan bir arayüz/kod bulunamadı (muhtemelen doğrudan
-- veritabanından elle değiştirilmiş); ancak organizations tablosundaki
-- mevcut UPDATE RLS politikası (fix_normal_role_org_renewal_rls.sql)
-- satır bazlı olduğu için şirket sahibi/normal rolündeki bir kullanıcı
-- teorik olarak bu kolonları da (arayüz olmasa bile doğrudan API
-- çağrısıyla) değiştirebilirdi.
--
-- Bu migration bir BEFORE UPDATE trigger ekleyerek storage_preference
-- ve tüm google_* kolonlarını admin (is_admin()) olmayan kullanıcılar
-- için değişmez hale getiriyor - başka alanları (isim, telefon vb.)
-- güncelleyen normal UPDATE çağrıları etkilenmez, sadece bu spesifik
-- kolonlardaki değişiklik admin değilse sessizce eski değerine geri
-- döndürülür.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.protect_google_drive_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.storage_preference := OLD.storage_preference;
    NEW.google_client_id := OLD.google_client_id;
    NEW.google_client_secret := OLD.google_client_secret;
    NEW.google_drive_folder_id := OLD.google_drive_folder_id;
    NEW.google_drive_access_token := OLD.google_drive_access_token;
    NEW.google_drive_refresh_token := OLD.google_drive_refresh_token;
    NEW.google_drive_connected_email := OLD.google_drive_connected_email;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_google_drive_settings_trigger ON public.organizations;
CREATE TRIGGER protect_google_drive_settings_trigger
BEFORE UPDATE ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.protect_google_drive_settings();

-- Sistemi şimdilik tamamen Supabase depolamaya sabitle
UPDATE public.organizations SET storage_preference = 'supabase' WHERE storage_preference IS DISTINCT FROM 'supabase';
