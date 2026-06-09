-- ==========================================
-- EVRAKLAB FULL SUPABASE INITIALIZATION DATABASE SCHEMA
-- ==========================================

-- Enable the UUID extension for generating random UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 1. ORGANIZATIONS & COMPANIES VIEW
-- ==========================================

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    member_limit INTEGER DEFAULT 5,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    storage_limit BIGINT DEFAULT 524288000, -- Default: 500 MB in bytes
    is_environmental_consultant BOOLEAN DEFAULT FALSE,
    consultant_logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Updatable view for backward compatibility (interchangeable use of 'companies' and 'organizations')
CREATE OR REPLACE VIEW companies AS 
SELECT * FROM organizations;

-- ==========================================
-- 2. PROFILES
-- ==========================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY, -- References auth.users(id)
    full_name TEXT,
    email TEXT,
    phone TEXT,
    role TEXT DEFAULT 'normal', -- 'normal', 'premium_individual', 'premium_corporate', 'corporate_chief', 'corporate_staff', 'admin', 'system_admin'
    org_role TEXT DEFAULT 'staff', -- 'admin', 'staff', etc.
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    subscription_end_date TIMESTAMP WITH TIME ZONE,
    storage_limit BIGINT DEFAULT 52428800, -- Default: 50 MB in bytes
    avatar_url TEXT,
    can_view_regulations BOOLEAN DEFAULT FALSE,
    can_manage_regulations BOOLEAN DEFAULT FALSE,
    permissions JSONB DEFAULT '{}'::jsonb,
    extra_permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. USER DEFINITIONS (Document Types & Locations)
-- ==========================================

CREATE TABLE IF NOT EXISTS user_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'doc_type', 'location'
    label TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 4. DOCUMENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    uploader_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    type_def_id UUID REFERENCES user_definitions(id) ON DELETE SET NULL,
    location_def_id UUID REFERENCES user_definitions(id) ON DELETE SET NULL,
    acquisition_date DATE NOT NULL,
    expiry_date DATE,
    application_deadline DATE,
    is_indefinite BOOLEAN DEFAULT FALSE,
    reminder_days INTEGER DEFAULT 0,
    reminder_based_on TEXT DEFAULT 'expiry',
    is_archived BOOLEAN DEFAULT FALSE,
    file_url TEXT,
    file_type TEXT,
    file_size BIGINT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 5. NOTIFICATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'system_admin_announcement', 'system_admin_msg', 'invite', etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 6. COMPANY MESSAGES & TEAM CHAT
-- ==========================================

CREATE TABLE IF NOT EXISTS company_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES profiles(id) ON DELETE SET NULL, -- NULL means General Chat
    message TEXT NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    document_title TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_reads (
    message_id UUID REFERENCES company_messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS chat_settings (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL, -- 'general' or peer user_id
    is_muted BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (user_id, target_id)
);

-- ==========================================
-- 7. SUPPORT SYSTEM
-- ==========================================

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'open', -- 'open', 'replied', 'closed'
    has_unread_messages BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ticket_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    sender_role TEXT NOT NULL, -- 'user', 'admin'
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 8. ORGANIZATIONAL INVITATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    is_used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 9. TOOL USAGES (PDF Tools Logger)
-- ==========================================

CREATE TABLE IF NOT EXISTS tool_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    tool_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 10. REGULATIONS & ARTICLES
-- ==========================================

CREATE TABLE IF NOT EXISTS pdf_regulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    publication_date DATE,
    effective_date DATE,
    rg_no TEXT,
    rg_date DATE,
    company_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pdf_articles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id UUID REFERENCES pdf_regulations(id) ON DELETE CASCADE,
    article_no TEXT,
    title TEXT,
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_pdf_regulations (
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    regulation_id UUID REFERENCES pdf_regulations(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, regulation_id)
);

CREATE TABLE IF NOT EXISTS company_pdf_regulations (
    company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    regulation_id UUID REFERENCES pdf_regulations(id) ON DELETE CASCADE,
    PRIMARY KEY (company_id, regulation_id)
);

CREATE TABLE IF NOT EXISTS regulation_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    regulation_id UUID REFERENCES pdf_regulations(id) ON DELETE CASCADE,
    article_id UUID REFERENCES pdf_articles(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 11. ENVIRONMENTAL CONSULTANCY CLIENTS & REPORTS
-- ==========================================

CREATE TABLE IF NOT EXISTS consultant_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultant_company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    address TEXT,
    tax_no TEXT,
    phone TEXT,
    email TEXT,
    logo_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultant_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES consultant_clients(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, user_id)
);

CREATE TABLE IF NOT EXISTS env_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES consultant_clients(id) ON DELETE CASCADE,
    consultant_company_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    creator_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    report_type TEXT NOT NULL, -- 'monthly' or 'yearly'
    report_date DATE NOT NULL,
    expires_at DATE, -- 1 ay veya 1 yıl sonrası
    is_manual_upload BOOLEAN DEFAULT FALSE,
    file_url TEXT, -- Manuel yüklendiyse
    form_data JSONB, -- Sistem üzerinden doldurulduysa tüm alanlar
    status TEXT DEFAULT 'draft', -- 'draft', 'completed'
    signature_link_token TEXT, -- Uzaktan imza için şifreli/güvenli token
    coordinator_signature JSONB, -- { signed_at, ip, name } vb.
    engineer_signature JSONB,
    client_signature JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 12. RPC FUNCTIONS (Supabase Functions)
-- ==========================================

-- A. Get Chat Unread Count
CREATE OR REPLACE FUNCTION public.get_unread_count(user_uid UUID, org_uid UUID)
RETURNS INTEGER AS $$
DECLARE
  unread_cnt INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO unread_cnt
  FROM public.company_messages cm
  WHERE cm.organization_id = org_uid
    AND cm.sender_id != user_uid
    AND (cm.receiver_id IS NULL OR cm.receiver_id = user_uid)
    AND NOT EXISTS (
      SELECT 1 
      FROM public.message_reads mr 
      WHERE mr.message_id = cm.id 
        AND mr.user_id = user_uid
    );
    
  RETURN unread_cnt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- B. Check and Downgrade Subscriptions
CREATE OR REPLACE FUNCTION public.check_and_downgrade_subscriptions()
RETURNS VOID AS $$
BEGIN
  -- 1. Downgrade individual users whose subscription has expired
  UPDATE public.profiles
  SET role = 'normal', subscription_end_date = NULL
  WHERE subscription_end_date IS NOT NULL 
    AND subscription_end_date < NOW() 
    AND role = 'premium_individual';

  -- 2. Downgrade corporate users whose organization subscription has expired
  UPDATE public.profiles p
  SET role = 'normal'
  FROM public.organizations o
  WHERE p.organization_id = o.id
    AND o.subscription_end_date IS NOT NULL
    AND o.subscription_end_date < NOW()
    AND p.role IN ('premium_corporate', 'corporate_chief', 'corporate_staff');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- C. Add Storage Limit
CREATE OR REPLACE FUNCTION public.add_storage_limit(target_id UUID, is_corporate BOOLEAN, bytes_to_add BIGINT)
RETURNS VOID AS $$
BEGIN
  IF is_corporate THEN
    UPDATE public.organizations
    SET storage_limit = COALESCE(storage_limit, 0) + bytes_to_add
    WHERE id = target_id;
  ELSE
    UPDATE public.profiles
    SET storage_limit = COALESCE(storage_limit, 0) + bytes_to_add
    WHERE id = target_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- D. Get Organization Storage Usage
CREATE OR REPLACE FUNCTION public.get_org_storage_usage(org_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total_usage BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)::BIGINT INTO total_usage
  FROM public.documents
  WHERE organization_id = org_id;
  
  RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- E. Get User Storage Usage
CREATE OR REPLACE FUNCTION public.get_user_storage_usage(target_user_id UUID)
RETURNS BIGINT AS $$
DECLARE
  total_usage BIGINT;
BEGIN
  SELECT COALESCE(SUM(file_size), 0)::BIGINT INTO total_usage
  FROM public.documents
  WHERE uploader_id = target_user_id 
    AND organization_id IS NULL;
    
  RETURN total_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- F. Delete User by Admin
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id UUID)
RETURNS VOID AS $$
BEGIN
  -- Istek yapan kullanıcının admin olup olmadığını kontrol edelim
  IF NOT (SELECT public.is_admin()) THEN
    RAISE EXCEPTION 'Bu işlem için admin yetkisi gereklidir.';
  END IF;

  -- Profil verisini sil
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- auth.users tablosundaki kaydı sil (böylece aynı maille tekrar kaydolabilir)
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==========================================
-- 13. AUTH AUTOMATION TRIGGER (profiles creation)
-- ==========================================

-- E-posta onayını otomatik yapmak için trigger fonksiyonu
CREATE OR REPLACE FUNCTION public.auto_confirm_user()
RETURNS TRIGGER AS $$
BEGIN
  NEW.email_confirmed_at = NOW();
  NEW.confirmed_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı auth.users tablosuna BEFORE INSERT olarak ekleyelim
DROP TRIGGER IF EXISTS on_auth_user_created_auto_confirm ON auth.users;
CREATE TRIGGER on_auth_user_created_auto_confirm
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.auto_confirm_user();

-- Automated profile creator function when registering through auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, phone, role, created_at, updated_at)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    COALESCE(new.raw_user_meta_data->>'phone', ''),
    'normal',
    now(),
    now()
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger association
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 14. ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================

-- Enable RLS for profiles and other tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE env_reports ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND (role = 'admin' OR role = 'system_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Users can view all profiles" ON public.profiles
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can manage all profiles" ON public.profiles
FOR ALL
TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

-- consultant_clients policies
CREATE POLICY "Consultants can view their own clients"
ON consultant_clients FOR SELECT
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid()
));

CREATE POLICY "Consultant admins can manage their clients"
ON consultant_clients FOR ALL
USING (consultant_company_id IN (
    SELECT organization_id FROM profiles WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
));

-- consultant_assignments policies
CREATE POLICY "Users can view assignments in their company"
ON consultant_assignments FOR SELECT
USING (client_id IN (
    SELECT id FROM consultant_clients WHERE consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
));

CREATE POLICY "Consultant admins can manage assignments"
ON consultant_assignments FOR ALL
USING (client_id IN (
    SELECT id FROM consultant_clients WHERE consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
    )
));

-- env_reports policies
CREATE POLICY "Users can view reports in their company"
ON env_reports FOR SELECT
USING (
    consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    OR creator_id = auth.uid()
);

CREATE POLICY "Assigned users and admins can manage reports"
ON env_reports FOR ALL
USING (
    consultant_company_id IN (
        SELECT organization_id FROM profiles WHERE id = auth.uid()
    )
    AND (
        creator_id = auth.uid() 
        OR 
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND (role = 'corporate_chief' OR role = 'premium_corporate')
            AND organization_id = env_reports.consultant_company_id
        )
    )
);

-- ==========================================
-- 15. STORAGE BUCKETS SETUP & POLICIES
-- ==========================================

-- 1. Create public buckets if they don't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('client_assets', 'client_assets', true),
  ('documents', 'documents', true),
  ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remove any conflicting policies
DROP POLICY IF EXISTS "Allow public insert into client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on client_assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from client_assets" ON storage.objects;

DROP POLICY IF EXISTS "Allow public insert into documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on documents" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from documents" ON storage.objects;

DROP POLICY IF EXISTS "Allow public insert into avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public select from avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update on avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from avatars" ON storage.objects;

-- 3. Create client_assets RLS policies
CREATE POLICY "Allow public insert into client_assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client_assets');
CREATE POLICY "Allow public select from client_assets" ON storage.objects FOR SELECT USING (bucket_id = 'client_assets');
CREATE POLICY "Allow public update on client_assets" ON storage.objects FOR UPDATE USING (bucket_id = 'client_assets');
CREATE POLICY "Allow public delete from client_assets" ON storage.objects FOR DELETE USING (bucket_id = 'client_assets');

-- 4. Create documents RLS policies
CREATE POLICY "Allow public insert into documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
CREATE POLICY "Allow public select from documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow public update on documents" ON storage.objects FOR UPDATE USING (bucket_id = 'documents');
CREATE POLICY "Allow public delete from documents" ON storage.objects FOR DELETE USING (bucket_id = 'documents');

-- 5. Create avatars RLS policies
CREATE POLICY "Allow public insert into avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Allow public select from avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Allow public update on avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars');
CREATE POLICY "Allow public delete from avatars" ON storage.objects FOR DELETE USING (bucket_id = 'avatars');
