-- ==========================================================
-- EVRAKLAB PERSONEL KARTI (employee_details) + PERSONEL GİDERLERİ
-- ==========================================================
-- Firma sahibine özel personel kartı (işe başlangıç, pozisyon,
-- departman, maaş) ve gider kayıtlarının kişiye bağlanabilmesi için.
--
-- Maaş gibi hassas veri BİLEREK profiles tablosuna değil, ayrı bir
-- tabloya konuluyor: bu sayede kod tabanındaki mevcut
-- `profiles.select('*')` tarzı genel sorgular maaşı yanlışlıkla
-- sızdırmaz — erişim tamamen bu tablonun RLS'ine bağlı kalır.

-- 1. Personel detay tablosu
CREATE TABLE IF NOT EXISTS public.employee_details (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    hire_date DATE,
    position TEXT,
    department TEXT,
    monthly_salary NUMERIC(15, 2),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Gider kayıtlarının belirli bir personele bağlanabilmesi için
ALTER TABLE public.company_expenses
ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 3. RLS
ALTER TABLE public.employee_details ENABLE ROW LEVEL SECURITY;

-- Sadece firma sahibi (premium_corporate) kendi organizasyonundaki
-- personel detaylarını görebilir/düzenleyebilir — şefler (corporate_chief)
-- dahil hiçbir başka rol erişemez.
CREATE POLICY "Owner manages own org employee details" ON public.employee_details
    FOR ALL
    USING (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_details.organization_id
              AND p.role = 'premium_corporate'
        )
    )
    WITH CHECK (
        auth.uid() IN (
            SELECT p.id FROM public.profiles p
            WHERE p.organization_id = employee_details.organization_id
              AND p.role = 'premium_corporate'
        )
    );
