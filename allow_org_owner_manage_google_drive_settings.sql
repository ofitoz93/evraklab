-- ==========================================================
-- FİRMA SAHİBİNİN KENDİ GOOGLE DRIVE AYARLARINI YÖNETMESİNE İZİN VER
--
-- fix_lock_google_drive_settings_to_admin.sql, storage_preference ve
-- tüm google_* kolonlarını sadece admin (is_admin()) değiştirebilsin diye
-- bir BEFORE UPDATE trigger ile kilitlemişti.
--
-- src/ConsultantPanel.tsx'teki "Depolama Ayarları" sekmesi (storage_settings
-- tab; handleSaveStorageSettings / handleConnectGoogleDriveOwner /
-- handleDisconnectGoogleDriveOwner) firma sahibinin (premium_corporate) bu
-- ayarları admin'e ihtiyaç duymadan kendi panelinden yönetebilmesi için
-- zaten inşa edilmişti — ama bu trigger yüzünden owner'ın UPDATE çağrıları
-- sessizce eski değerlerine geri dönüyordu (arayüz vardı ama fonksiyonel
-- değildi). Bu migration, admin'e ek olarak kendi organizasyonunun
-- premium_corporate sahibinin de bu kolonları değiştirebilmesine izin verir.
--
-- Diğer roller (corporate_chief, corporate_staff, normal vb.) hâlâ
-- engellenir — sadece organizasyonun kendi sahibi (owner) ve admin.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.protect_google_drive_settings()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT (
    public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND organization_id = OLD.id
        AND role = 'premium_corporate'
    )
  ) THEN
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
