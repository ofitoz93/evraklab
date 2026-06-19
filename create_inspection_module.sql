-- ==========================================================
-- QR KODLU SAHA DENETİM FORMÜLÜ - VERİTABANI ŞEMASI
-- ==========================================================

-- 1. inspection_forms - Form Tanımları
CREATE TABLE IF NOT EXISTS public.inspection_forms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.consultant_clients(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- 2. inspection_questions - Form Soruları
CREATE TABLE IF NOT EXISTS public.inspection_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.inspection_forms(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN ('yes_no', 'compliant', 'text', 'rating')),
    is_required BOOLEAN DEFAULT TRUE
);

-- 3. inspection_points - Fiziksel Denetim Noktaları
CREATE TABLE IF NOT EXISTS public.inspection_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    form_id UUID NOT NULL REFERENCES public.inspection_forms(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    location_description TEXT,
    qr_token TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. inspection_submissions - Doldurulmuş Formlar
CREATE TABLE IF NOT EXISTS public.inspection_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES public.inspection_points(id) ON DELETE CASCADE,
    submitted_by_name TEXT,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    general_notes TEXT,
    photos JSONB DEFAULT '[]'::jsonb
);

-- 5. inspection_answers - Sorulara Verilen Cevaplar
CREATE TABLE IF NOT EXISTS public.inspection_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id UUID NOT NULL REFERENCES public.inspection_submissions(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.inspection_questions(id) ON DELETE CASCADE,
    answer_bool BOOLEAN,
    answer_text TEXT
);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

ALTER TABLE public.inspection_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspection_answers ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to prevent "already exists" errors during re-runs
DROP POLICY IF EXISTS "Allow public select on forms with active points" ON public.inspection_forms;
DROP POLICY IF EXISTS "Allow select on forms" ON public.inspection_forms;
DROP POLICY IF EXISTS "Allow consultant managers to edit forms" ON public.inspection_forms;
DROP POLICY IF EXISTS "Allow consultant employees to manage forms" ON public.inspection_forms;

DROP POLICY IF EXISTS "Allow public select on questions for readable forms" ON public.inspection_questions;
DROP POLICY IF EXISTS "Allow select on questions" ON public.inspection_questions;
DROP POLICY IF EXISTS "Allow consultant managers to edit questions" ON public.inspection_questions;
DROP POLICY IF EXISTS "Allow consultant employees to manage questions" ON public.inspection_questions;

DROP POLICY IF EXISTS "Allow public select on points" ON public.inspection_points;
DROP POLICY IF EXISTS "Allow consultant managers to edit points" ON public.inspection_points;
DROP POLICY IF EXISTS "Allow consultant employees to manage points" ON public.inspection_points;

DROP POLICY IF EXISTS "Allow public to insert submissions" ON public.inspection_submissions;
DROP POLICY IF EXISTS "Allow consultant employees to view submissions" ON public.inspection_submissions;
DROP POLICY IF EXISTS "Allow consultant managers to edit/delete submissions" ON public.inspection_submissions;
DROP POLICY IF EXISTS "Allow consultant employees to edit/delete submissions" ON public.inspection_submissions;

DROP POLICY IF EXISTS "Allow public to insert answers" ON public.inspection_answers;
DROP POLICY IF EXISTS "Allow consultant employees to view answers" ON public.inspection_answers;
DROP POLICY IF EXISTS "Allow consultant managers to edit/delete answers" ON public.inspection_answers;
DROP POLICY IF EXISTS "Allow consultant employees to edit/delete answers" ON public.inspection_answers;

-- A. inspection_forms Policies
CREATE POLICY "Allow select on forms" ON public.inspection_forms
    FOR SELECT USING (
        is_active = true
        OR organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

CREATE POLICY "Allow consultant employees to manage forms" ON public.inspection_forms
    FOR ALL USING (
        organization_id IN (
            SELECT organization_id FROM public.profiles 
            WHERE id = auth.uid() 
            AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'admin' OR role = 'system_admin')
        )
    );

-- B. inspection_questions Policies
CREATE POLICY "Allow select on questions" ON public.inspection_questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.inspection_forms f 
            WHERE f.id = form_id 
            AND (
                f.is_active = true
                OR f.organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
            )
        )
    );

CREATE POLICY "Allow consultant employees to manage questions" ON public.inspection_questions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_forms f 
            WHERE f.id = form_id 
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- C. inspection_points Policies
CREATE POLICY "Allow public select on points" ON public.inspection_points
    FOR SELECT USING (true);

CREATE POLICY "Allow consultant employees to manage points" ON public.inspection_points
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_forms f 
            WHERE f.id = form_id 
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- D. inspection_submissions Policies
CREATE POLICY "Allow public to insert submissions" ON public.inspection_submissions
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow consultant employees to view submissions" ON public.inspection_submissions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.inspection_points p 
            JOIN public.inspection_forms f ON p.form_id = f.id 
            WHERE p.id = point_id 
            AND f.organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Allow consultant employees to edit/delete submissions" ON public.inspection_submissions
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_points p 
            JOIN public.inspection_forms f ON p.form_id = f.id 
            WHERE p.id = point_id 
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- E. inspection_answers Policies
CREATE POLICY "Allow public to insert answers" ON public.inspection_answers
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow consultant employees to view answers" ON public.inspection_answers
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.inspection_submissions s 
            JOIN public.inspection_points p ON s.point_id = p.id 
            JOIN public.inspection_forms f ON p.form_id = f.id 
            WHERE s.id = submission_id 
            AND f.organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Allow consultant employees to edit/delete answers" ON public.inspection_answers
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.inspection_submissions s 
            JOIN public.inspection_points p ON s.point_id = p.id 
            JOIN public.inspection_forms f ON p.form_id = f.id 
            WHERE s.id = submission_id 
            AND f.organization_id IN (
                SELECT organization_id FROM public.profiles 
                WHERE id = auth.uid() 
                AND (role = 'corporate_chief' OR role = 'premium_corporate' OR role = 'corporate_staff' OR role = 'admin' OR role = 'system_admin')
            )
        )
    );

-- ==========================================================
-- INDEXES FOR PERFORMANCE
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_inspection_forms_org_client ON public.inspection_forms(organization_id, client_id);
CREATE INDEX IF NOT EXISTS idx_inspection_questions_form ON public.inspection_questions(form_id, order_index);
CREATE INDEX IF NOT EXISTS idx_inspection_points_form ON public.inspection_points(form_id);
CREATE INDEX IF NOT EXISTS idx_inspection_points_token ON public.inspection_points(qr_token);
CREATE INDEX IF NOT EXISTS idx_inspection_submissions_point ON public.inspection_submissions(point_id);
CREATE INDEX IF NOT EXISTS idx_inspection_answers_submission ON public.inspection_answers(submission_id);
