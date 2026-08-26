-- Faz 2: Resmi Gazete günlük bülteninden otomatik çekilen yönetmelik/tebliğ
-- adayları, admin onaylamadan gerçek pdf_regulations havuzuna hiç girmesin
-- diye ayrı bir bekleme tablosunda tutulur. api/fetch-resmi-gazete.ts (günlük
-- Vercel Cron ile tetiklenir) buraya 'pending' durumunda satır ekler;
-- AdminPanel > Mevzuat Havuzu > "Otomatik Taranan Mevzuatlar" sekmesinden
-- admin onaylarsa pdf_regulations/pdf_articles'a kopyalanır, reddederse
-- sadece status güncellenir (satır silinmez — aynı kayıt source_url'i
-- yüzünden tekrar tekrar taranıp kuyruğa düşmesin diye).

CREATE TABLE IF NOT EXISTS public.scraped_regulation_candidates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL DEFAULT 'resmi_gazete',
    source_url TEXT NOT NULL,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'Yönetmelik',
    publication_date DATE,
    effective_date DATE,
    rg_no TEXT,
    rg_date DATE,
    articles JSONB DEFAULT '[]'::jsonb, -- [{article_no, title, content, order_index}]
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    fetched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    review_note TEXT,
    UNIQUE (source, source_url)
);

CREATE INDEX IF NOT EXISTS idx_scraped_regulation_candidates_status
    ON public.scraped_regulation_candidates(status);

ALTER TABLE public.scraped_regulation_candidates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage scraped_regulation_candidates" ON public.scraped_regulation_candidates;
CREATE POLICY "Admin manage scraped_regulation_candidates" ON public.scraped_regulation_candidates
    FOR ALL TO authenticated USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'system_admin'))
    );

-- api/fetch-resmi-gazete.ts service-role istemcisiyle (Supabase servis
-- anahtarı) çalışır ve RLS'yi zaten atlar; bu politika yalnızca uygulama
-- içinden (AdminPanel) authenticated erişimi admin ile sınırlar.
