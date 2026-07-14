-- ==========================================================
-- EVRAKLAB PERSONEL BELGELERİ (employee_documents)
-- ==========================================================
-- Personel Kartı'ndaki "Belgeler" sekmesi için: firma sahibi bir belge
-- türü (SGK Sicil Belgesi, Kimlik Fotokopisi vb.) oluşturup o türde
-- personele özel dosya yükleyebilir. Belge türleri user_definitions
-- tablosunda category='personnel_doc_type' + organization_id ile
-- tutulur (şema değişikliği gerekmez, category zaten düz TEXT) — bu
-- sayede bir personel için oluşturulan tür, aynı organizasyondaki
-- diğer personellerin kartında da seçenek olarak çıkar.
--
-- Belgenin kendisi (dosya + kime ait olduğu) employee_details ile aynı
-- hassasiyette: ayrı bir tabloda, sadece firma sahibine (premium_corporate)
-- açık RLS ile tutuluyor.

CREATE TABLE IF NOT EXISTS public.employee_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    doc_type_id UUID REFERENCES public.user_definitions(id) ON DELETE SET NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own org employee documents" ON public.employee_documents
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_documents.organization_id
              AND p.role = 'premium_corporate'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_documents.organization_id
              AND p.role = 'premium_corporate'
        )
    );
