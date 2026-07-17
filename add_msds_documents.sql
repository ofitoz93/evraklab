-- ==========================================================
-- TOPLU MSDS/SDS TAKİBİ (Danışman -> Hizmet Verilen İşletme)
-- Danışman personeli, atandığı işletmeler için toplu MSDS/SDS
-- (Malzeme Güvenlik Bilgi Formu) PDF'i yükler; ürün adı ve "ana
-- tarih" (revizyon/yayın tarihine göre en güncel etiketli tarih)
-- istemci tarafında otomatik tespit edilir (src/msdsParser.ts),
-- geçerlilik süresi (varsayılan 5 yıl) buradan hesaplanır.
--
-- Her satır, aynı zamanda gerçek bir public.documents kaydına da
-- bağlanır (document_id) — böylece mevcut expiry_date/reminder_days
-- tabanlı günlük hatırlatma e-postası (fix_expiry_reminders.sql,
-- send_expiry_reminders()) hiçbir ek işe gerek kalmadan MSDS'leri
-- de otomatik kapsar.
--
-- "status" (Süresi Doldu/Yaklaşıyor/Geçerli) kasıtlı olarak
-- saklanmaz — CURRENT_DATE immutable olmadığı için generated
-- column olamaz; her zaman expiry_date'ten okuma anında türetilir
-- (bkz. src/msdsParser.ts computeMsdsStatus).
-- ==========================================================

CREATE TABLE IF NOT EXISTS public.msds_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
  consultant_company_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Ürün adı
  product_name TEXT,
  product_name_source TEXT,              -- eşleşen etiket metni ya da 'heuristic_top_lines'
  product_name_manual_override BOOLEAN NOT NULL DEFAULT FALSE,

  -- Geçerlilik hesabının dayandığı "ana tarih"
  primary_date DATE,
  primary_date_source_label TEXT,        -- örn. "Revizyon Tarihi"; manuel girişte NULL
  primary_date_tier SMALLINT,            -- 1 (revizyon) / 2 (yayın) / 3 (jenerik)
  primary_date_day_defaulted BOOLEAN NOT NULL DEFAULT FALSE,  -- ay/yıl formatından geldi, gün=1 varsayıldı
  primary_date_manual_override BOOLEAN NOT NULL DEFAULT FALSE,

  other_dates JSONB NOT NULL DEFAULT '[]'::jsonb,  -- [{date, label, tier, rawMatch}] - bilgi amaçlı, hesaba katılmaz

  validity_years NUMERIC(4,1) NOT NULL DEFAULT 5,
  warning_threshold_days INTEGER NOT NULL DEFAULT 30,
  expiry_date DATE,

  extraction_status TEXT NOT NULL DEFAULT 'auto'
    CHECK (extraction_status IN ('auto', 'manual', 'failed_needs_review')),
  extracted_char_count INTEGER NOT NULL DEFAULT 0,

  original_file_name TEXT NOT NULL,
  file_url TEXT,
  file_type TEXT,
  file_size BIGINT DEFAULT 0,

  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.msds_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Consultant staff manage own msds_documents" ON public.msds_documents;
DROP POLICY IF EXISTS "Client view own msds_documents" ON public.msds_documents;

-- Danışman personeli: kendi organizasyonuna ait MSDS kayıtlarını tam yönetebilir.
-- ("Sadece atandığım firma" kısıtı, document_requests/env_reports dahil bu kod
-- tabanındaki HER yerde olduğu gibi, RLS'te değil uygulama katmanında yapılır
-- - bkz. ConsultantPanel.tsx getAssignmentUserIds + consultant_assignments.)
CREATE POLICY "Consultant staff manage own msds_documents" ON public.msds_documents
  FOR ALL USING (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    consultant_company_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

-- Müşteri: sadece kendi client_id'sine ait MSDS kayıtlarını görebilir (salt okunur)
CREATE POLICY "Client view own msds_documents" ON public.msds_documents
  FOR SELECT USING (
    client_id IN (SELECT client_id FROM public.profiles WHERE id = auth.uid() AND client_id IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS idx_msds_documents_client ON public.msds_documents(client_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_msds_documents_org ON public.msds_documents(consultant_company_id, is_archived);
CREATE INDEX IF NOT EXISTS idx_msds_documents_expiry ON public.msds_documents(expiry_date) WHERE is_archived = false;
