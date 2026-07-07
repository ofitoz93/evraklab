-- ==========================================================
-- BİREYSEL PREMİUM: "KENDİM İÇİN" MEVZUAT TAKİBİ
-- Supabase SQL Editor'de çalıştırın
--
-- Bireysel premium hesap, bir yönetmeliği belirli bir lokasyon/işletmeye
-- bağlamadan da (Mevzuat Takip ekranında "Kendim İçin" seçeneğiyle)
-- takip edebilsin diye consultant_clients tablosuna, uygulamanın kendi
-- org'una özel olarak otomatik oluşturduğu gizli bir "Kendim İçin" kaydını
-- ayırt edebilmesi için bir bayrak kolonu ekleniyor. Bu kayıt normal
-- İşletme/Lokasyon listelerinde (Dokümantasyon, Ziyaret, Atık, Aksiyon vb.)
-- HİÇ görünmez; sadece Mevzuat Takip ekranındaki ilgili 3 noktada
-- (Firmaya Ata modalı, Atanan Mevzuatlar filtresi, Takip sekmesi) uygulama
-- tarafında elle eklenir. Böylece client_regulations / client_regulation_articles
-- / compliance_actions gibi client_id'ye bağımlı tüm tablolar hiçbir şema
-- değişikliği gerekmeden aynen çalışmaya devam eder.
--
-- Ek bir RLS politikası GEREKMİYOR: "Consultant admins can manage their
-- clients" politikası (bkz. add_premium_individual_personal_org.sql) zaten
-- premium_individual rolünün kendi org'undaki consultant_clients kayıtlarını
-- yönetmesine izin veriyor; bu yeni kayıt da aynı org'a ait normal bir satır.
-- ==========================================================

ALTER TABLE public.consultant_clients
  ADD COLUMN IF NOT EXISTS is_self_tracking BOOLEAN DEFAULT FALSE;
