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
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
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
    metadata JSONB DEFAULT '{}'::jsonb, -- Store dynamic metadata (e.g. invite codes, requester details)
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
    email TEXT, -- Nullable to allow code-based invitations
    code TEXT,  -- Invitation code (e.g. X9Y2Z1)
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
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

-- ==========================================
-- 16. ADDITIONAL RLS POLICIES FOR CHAT, INVITATIONS, NOTIFICATIONS
-- ==========================================

-- Enable Row Level Security (RLS)
ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- company_messages Policies
CREATE POLICY "Allow users to read messages in their organization" ON public.company_messages
FOR SELECT TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  AND (
    receiver_id IS NULL -- general chat
    OR receiver_id = auth.uid() -- received DMs
    OR sender_id = auth.uid() -- sent DMs
  )
);

CREATE POLICY "Allow users to send messages in their organization" ON public.company_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_id = auth.uid()
  AND organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
);

-- message_reads Policies
CREATE POLICY "Allow users to manage their own message reads" ON public.message_reads
FOR ALL TO authenticated USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

-- chat_settings Policies
CREATE POLICY "Allow users to manage their own chat settings" ON public.chat_settings
FOR ALL TO authenticated USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

-- invitations Policies
CREATE POLICY "Allow users to select invitations" ON public.invitations
FOR SELECT TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles WHERE id = auth.uid()
  )
  OR is_used = false
);

CREATE POLICY "Allow managers to insert invitations" ON public.invitations
FOR INSERT TO authenticated WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'premium_corporate' OR role = 'corporate_chief' OR role = 'admin')
  )
);

CREATE POLICY "Allow managers to delete invitations" ON public.invitations
FOR DELETE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'premium_corporate' OR role = 'corporate_chief' OR role = 'admin')
  )
);

CREATE POLICY "Allow managers to update invitations" ON public.invitations
FOR UPDATE TO authenticated USING (
  organization_id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'premium_corporate' OR role = 'corporate_chief' OR role = 'admin')
  )
) WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM public.profiles 
    WHERE id = auth.uid() 
    AND (role = 'premium_corporate' OR role = 'corporate_chief' OR role = 'admin')
  )
);

-- notifications Policies
CREATE POLICY "Allow users to read own or requested notifications" ON public.notifications
FOR SELECT TO authenticated USING (
  user_id = auth.uid()
  OR (
    type = 'join_request'
    AND metadata->>'requester_id' = auth.uid()::text
  )
);

CREATE POLICY "Allow authenticated to insert notifications" ON public.notifications
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow users to update own notifications" ON public.notifications
FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow users to delete own or requested notifications" ON public.notifications
FOR DELETE TO authenticated USING (
  user_id = auth.uid()
  OR (
    type = 'join_request'
    AND metadata->>'requester_id' = auth.uid()::text
  )
);

-- ==========================================
-- 17. ADDITIONAL RLS POLICIES FOR PROFILES
-- ==========================================
DROP POLICY IF EXISTS "Allow company managers to join users to their company" ON public.profiles;

CREATE POLICY "Allow company managers to join users to their company" ON public.profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles manager
    WHERE manager.id = auth.uid()
    AND (manager.role = 'premium_corporate' OR manager.role = 'corporate_chief' OR manager.role = 'admin' OR manager.role = 'system_admin')
    AND (profiles.organization_id IS NULL OR profiles.organization_id = manager.organization_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles manager
    WHERE manager.id = auth.uid()
    AND (manager.role = 'premium_corporate' OR manager.role = 'corporate_chief' OR manager.role = 'admin' OR manager.role = 'system_admin')
    AND profiles.organization_id = manager.organization_id
  )
);

-- ==========================================
-- 18. RLS POLICIES FOR SUPPORT TICKETS & MESSAGES
-- ==========================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets" ON public.tickets
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage all tickets" ON public.tickets
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can view messages for own tickets" ON public.ticket_messages
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "Users can insert messages for own tickets" ON public.ticket_messages
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "Admins can manage all ticket messages" ON public.ticket_messages
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==========================================
-- 19. RLS POLICIES FOR USER_DEFINITIONS
-- ==========================================
ALTER TABLE public.user_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  -- Personal definitions: only the owner can see them
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate definitions:
  (
    organization_id IS NOT NULL 
    AND (
      -- 1. Managers, chiefs, and admins can view all definitions in their organization
      EXISTS (
        SELECT 1 FROM public.profiles manager
        WHERE manager.id = auth.uid()
        AND manager.organization_id = user_definitions.organization_id
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      )
      OR
      -- 2. Normal staff can only view definitions assigned to themselves
      user_id = auth.uid()
    )
  )
);

CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  -- Personal: owner can insert
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers, chiefs, admins of the organization can insert
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
) WITH CHECK (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

CREATE POLICY "Allow users to delete definitions" ON public.user_definitions
FOR DELETE TO authenticated USING (
  (
    -- Personal: owner can delete
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    -- Corporate: managers/chiefs/admins of the organization can delete
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles target
        JOIN public.profiles manager ON manager.organization_id = target.organization_id
        WHERE manager.id = auth.uid()
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        AND target.id = user_definitions.user_id
        AND manager.organization_id = user_definitions.organization_id
      )
    )
  )
  -- Restrict deleting locations that match registered businesses in the organization
  AND NOT (
    category = 'location'
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.consultant_company_id = user_definitions.organization_id
      AND LOWER(cc.name) = LOWER(user_definitions.label)
    )
  )
);

-- ==========================================
-- 20. EMAIL SETTINGS & LOGS SCHEMAS & FUNCTIONS
-- ==========================================

-- Enable pg_net extension for HTTP requests (needed for pg_net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create email_settings table
CREATE TABLE IF NOT EXISTS public.email_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize default settings
INSERT INTO public.email_settings (key, value)
VALUES 
  ('email_provider', 'google_script'),
  ('api_key', ''),
  ('sender_email', ''),
  ('script_url', 'https://script.google.com/macros/s/AKfycbw-HSOy-SkeFtxP-pChNeuUJ3F9xRDnMZHb_1R7db8n30A6H9S_PAhh84bpevGzYBGlOw/exec')
ON CONFLICT (key) DO NOTHING;

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent', 'expired'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Admins can manage email settings" ON public.email_settings
    AND profiles.organization_id = manager.organization_id
  )
);

-- ==========================================
-- 18. RLS POLICIES FOR SUPPORT TICKETS & MESSAGES
-- ==========================================
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Users can insert own tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tickets" ON public.tickets
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

CREATE POLICY "Admins can manage all tickets" ON public.tickets
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Users can view messages for own tickets" ON public.ticket_messages
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "Users can insert messages for own tickets" ON public.ticket_messages
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

CREATE POLICY "Admins can manage all ticket messages" ON public.ticket_messages
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());


-- ==========================================
-- 19. RLS POLICIES FOR USER_DEFINITIONS
-- ==========================================
ALTER TABLE public.user_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow users to view definitions" ON public.user_definitions
FOR SELECT TO authenticated USING (
  -- Personal definitions: only the owner can see them
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate definitions:
  (
    organization_id IS NOT NULL 
    AND (
      -- 1. Managers, chiefs, and admins can view all definitions in their organization
      EXISTS (
        SELECT 1 FROM public.profiles manager
        WHERE manager.id = auth.uid()
        AND manager.organization_id = user_definitions.organization_id
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      )
      OR
      -- 2. Normal staff can only view definitions assigned to themselves
      user_id = auth.uid()
    )
  )
);

CREATE POLICY "Allow users to insert definitions" ON public.user_definitions
FOR INSERT TO authenticated WITH CHECK (
  -- Personal: owner can insert
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers, chiefs, admins of the organization can insert
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

CREATE POLICY "Allow users to update definitions" ON public.user_definitions
FOR UPDATE TO authenticated USING (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
) WITH CHECK (
  -- Personal: owner can update
  (organization_id IS NULL AND user_id = auth.uid())
  OR
  -- Corporate: managers/chiefs/admins of the organization can update
  (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles target
      JOIN public.profiles manager ON manager.organization_id = target.organization_id
      WHERE manager.id = auth.uid()
      AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
      AND target.id = user_definitions.user_id
      AND manager.organization_id = user_definitions.organization_id
    )
  )
);

CREATE POLICY "Allow users to delete definitions" ON public.user_definitions
FOR DELETE TO authenticated USING (
  (
    -- Personal: owner can delete
    (organization_id IS NULL AND user_id = auth.uid())
    OR
    -- Corporate: managers/chiefs/admins of the organization can delete
    (
      organization_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles target
        JOIN public.profiles manager ON manager.organization_id = target.organization_id
        WHERE manager.id = auth.uid()
        AND manager.role IN ('premium_corporate', 'corporate_chief', 'admin', 'system_admin')
        AND target.id = user_definitions.user_id
        AND manager.organization_id = user_definitions.organization_id
      )
    )
  )
  -- Restrict deleting locations that match registered businesses in the organization
  AND NOT (
    category = 'location'
    AND organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.consultant_clients cc
      WHERE cc.consultant_company_id = user_definitions.organization_id
      AND LOWER(cc.name) = LOWER(user_definitions.label)
    )
  )
);

-- ==========================================
-- 20. EMAIL SETTINGS & LOGS SCHEMAS & FUNCTIONS
-- ==========================================

-- Enable pg_net extension for HTTP requests (needed for pg_net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create email_settings table
CREATE TABLE IF NOT EXISTS public.email_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Initialize default settings
INSERT INTO public.email_settings (key, value)
VALUES 
  ('email_provider', 'google_script'),
  ('api_key', ''),
  ('sender_email', ''),
  ('script_url', 'https://script.google.com/macros/s/AKfycbw-HSOy-SkeFtxP-pChNeuUJ3F9xRDnMZHb_1R7db8n30A6H9S_PAhh84bpevGzYBGlOw/exec')
ON CONFLICT (key) DO NOTHING;

-- Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent', 'expired'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies
CREATE POLICY "Admins can manage email settings" ON public.email_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow public select of system logo url" ON public.email_settings
FOR SELECT TO public USING (key = 'system_logo_url');

CREATE POLICY "Admins can view email logs" ON public.email_logs
FOR SELECT TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.send_expiry_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  doc RECORD;
  r_provider TEXT;
  r_api_key TEXT;
  r_sender TEXT;
  r_script_url TEXT;
  r_subject TEXT;
  r_html TEXT;
  r_rows TEXT;
  r_status_badge TEXT;
  cc_emails_str TEXT;
  cc_emails_json JSONB;
BEGIN
  -- Get settings
  SELECT value INTO r_provider FROM public.email_settings WHERE key = 'email_provider';
  SELECT value INTO r_api_key FROM public.email_settings WHERE key = 'api_key';
  SELECT value INTO r_sender FROM public.email_settings WHERE key = 'sender_email';
  SELECT value INTO r_script_url FROM public.email_settings WHERE key = 'script_url';
  
  -- Default provider to 'google_script' if not set
  IF r_provider IS NULL THEN
    r_provider := 'google_script';
  END IF;

  -- Verify configurations based on provider
  IF r_provider = 'google_script' AND r_script_url IS NULL THEN
    RETURN;
  ELSIF (r_provider = 'resend' OR r_provider = 'brevo') AND (r_api_key IS NULL OR r_sender IS NULL) THEN
    RETURN;
  END IF;

  -- Loop through all distinct recipients (uploader_id) who have at least one active document needing reminder
  FOR rec IN
    SELECT DISTINCT
      p.id AS recipient_id,
      p.email AS recipient_email,
      p.full_name AS recipient_name,
      p.organization_id
    FROM public.documents d
    JOIN public.profiles p ON p.id = d.uploader_id
    LEFT JOIN public.organizations org ON org.id = d.organization_id
    WHERE d.is_archived = false
      AND d.expiry_date IS NOT NULL
      AND d.is_indefinite = false
      AND d.reminder_days > 0
      AND (
        -- Corporate Premium Check
        (d.organization_id IS NOT NULL AND (org.subscription_end_date IS NULL OR org.subscription_end_date > NOW()))
        -- Personal Premium Check
        OR (d.organization_id IS NULL AND (p.subscription_end_date > NOW() OR p.role IN ('admin', 'system_admin')))
      )
      AND (
        -- Expiring in window or already expired
        (d.expiry_date - CURRENT_DATE) <= d.reminder_days
      )
  LOOP
    -- Build CC list for this uploader/recipient if they belong to an organization
    cc_emails_str := '';
    cc_emails_json := '[]'::jsonb;
    
    IF rec.organization_id IS NOT NULL THEN
      -- Get comma-separated string for Google Apps Script
      SELECT string_agg(email, ',') INTO cc_emails_str
      FROM public.profiles
      WHERE organization_id = rec.organization_id
        AND email <> rec.recipient_email
        AND (
          role = 'premium_corporate'
          OR (extra_permissions->>'receive_reminder_cc')::boolean = true
        );
        
      -- Get JSON array of emails for Resend
      SELECT jsonb_agg(email) INTO cc_emails_json
      FROM public.profiles
      WHERE organization_id = rec.organization_id
        AND email <> rec.recipient_email
        AND (
          role = 'premium_corporate'
          OR (extra_permissions->>'receive_reminder_cc')::boolean = true
        );
    END IF;

    -- Make sure cc_emails_json is not null
    IF cc_emails_json IS NULL THEN
      cc_emails_json := '[]'::jsonb;
    END IF;

    -- Construct HTML table rows for this recipient
    r_rows := '';
    FOR doc IN
      SELECT 
        d.id AS doc_id,
        d.title AS doc_title,
        d.expiry_date,
        d.reminder_days,
        (d.expiry_date - CURRENT_DATE) AS days_remaining,
        COALESCE(dtype.label, '-') AS doc_type,
        COALESCE(dloc.label, '-') AS doc_loc
      FROM public.documents d
      LEFT JOIN public.user_definitions dtype ON dtype.id = d.type_def_id
      LEFT JOIN public.user_definitions dloc ON dloc.id = d.location_def_id
      WHERE d.uploader_id = rec.recipient_id
        AND d.is_archived = false
        AND d.expiry_date IS NOT NULL
        AND d.is_indefinite = false
        AND d.reminder_days > 0
        AND ((d.expiry_date - CURRENT_DATE) <= d.reminder_days)
      ORDER BY d.expiry_date ASC
    LOOP
      -- Durum rozeti
      IF doc.days_remaining <= 0 THEN
        r_status_badge := '<span style="display: inline-block; background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fca5a5; white-space: nowrap;">⚠️ ' || abs(doc.days_remaining) || ' Gün Geçti</span>';
      ELSIF doc.days_remaining <= 7 THEN
        r_status_badge := '<span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fcd34d; white-space: nowrap;">⏳ ' || doc.days_remaining || ' Gün</span>';
      ELSE
        r_status_badge := '<span style="display: inline-block; background-color: #eff6ff; color: #1e40af; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #bfdbfe; white-space: nowrap;">📅 ' || doc.days_remaining || ' Gün</span>';
      END IF;

      -- Row HTML (Premium Spacing and Typography)
      r_rows := r_rows || '<tr style="background-color: #ffffff;">' ||
                '<td style="padding: 14px 16px; font-weight: 700; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9; line-height: 1.4;">' || COALESCE(doc.doc_title, '') || '</td>' ||
                '<td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9; line-height: 1.4;">' ||
                '<div style="font-size: 12px; color: #475569; font-weight: 500;">Tür: ' || COALESCE(doc.doc_type, '-') || '</div>' ||
                '<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Lokasyon: ' || COALESCE(doc.doc_loc, '-') || '</div>' ||
                '</td>' ||
                '<td style="padding: 14px 16px; color: #475569; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">' || to_char(doc.expiry_date, 'DD.MM.YYYY') || '</td>' ||
                '<td style="padding: 14px 16px; text-align: right; border-bottom: 1px solid #f1f5f9;">' || r_status_badge || '</td>' ||
                '</tr>';

      -- Log the email sending event for database history
      INSERT INTO public.email_logs (document_id, recipient_email, subject, status)
      VALUES (doc.doc_id, rec.recipient_email, 'Evrak Lab - Belge Süresi Günlük Özeti', 
              CASE WHEN doc.days_remaining > 0 THEN 'sent' ELSE 'expired' END);
    END LOOP;

    -- Complete the HTML template
    r_subject := 'Evrak Lab - Günlük Belge Süresi Hatırlatma Özeti';
    
    r_html := '<div style="background-color: #f1f5f9; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif;">' ||
              '<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">' ||
              '<div style="background: linear-gradient(135deg, #4f46e5 0%, #6366f1 50%, #818cf8 100%); padding: 32px 24px; text-align: center; color: #ffffff;">' ||
              '<div style="font-size: 28px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 4px;">Evrak<span style="color: #60a5fa;">LAB</span></div>' ||
              '<div style="font-size: 14px; opacity: 0.9; font-weight: 500;">Otomatik Evrak Süresi Hatırlatma Servisi</div>' ||
              '</div>' ||
              '<div style="padding: 32px 24px; background-color: #ffffff;">' ||
              '<h3 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Sayın ' || COALESCE(NULLIF(rec.recipient_name, ''), SPLIT_PART(rec.recipient_email, '@', 1)) || ',</h3>' ||
              '<p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Sistemde kayıtlı veya sorumluluğunuzda olan aşağıdaki belgelerin geçerlilik sürelerinin dolmasına az kalmış veya süreleri dolmuştur. Gecikme yaşamamak adına gerekli güncelleme işlemlerini yapmanızı rica ederiz.</p>' ||
              '<table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">' ||
              '<thead>' ||
              '<tr style="background-color: #f8fafc;">' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Belge Adı</th>' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Detaylar</th>' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Geçerlilik Tarihi</th>' ||
              '<th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Durum</th>' ||
              '</tr>' ||
              '</thead>' ||
              '<tbody>' ||
              r_rows ||
              '</tbody>' ||
              '</table>' ||
              '<div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">' ||
              '<div style="font-size: 13px; color: #475569; margin-bottom: 14px; line-height: 1.5;">' ||
              'Belgelerinizi güncellemek, yeni süre girmek veya arşivlemek için EvrakLAB sistem paneline giriş yapabilirsiniz.' ||
              '</div>' ||
              '<a href="https://evraklab.com" style="display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #6366f1 100%); color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(79, 70, 229, 0.2); transition: all 0.2s ease;">EvrakLAB Paneline Git</a>' ||
              '</div>' ||
              '</div>' ||
              '<div style="padding: 24px; text-align: center; font-size: 11px; color: #94a3b8; line-height: 1.6; border-top: 1px solid #e2e8f0; background-color: #fafafa;">' ||
              '<p style="margin: 0; font-weight: 500;">Bu e-posta EvrakLAB otomatik bilgilendirme servisi tarafından gönderilmiştir. Lütfen doğrudan yanıtlamayınız.</p>' ||
              '<p style="margin: 4px 0 0 0;">© 2026 EvrakLAB. Tüm hakları saklıdır.</p>' ||
              '</div>' ||
              '</div>' ||
              '</div>';

    -- Send HTTP call depending on selected provider
    IF r_provider = 'google_script' THEN
      PERFORM net.http_post(
        url := r_script_url,
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'to', rec.recipient_email,
          'cc', COALESCE(cc_emails_str, ''),
          'subject', r_subject,
          'html', r_html
        )
      );
    ELSIF r_provider = 'resend' THEN
      IF jsonb_array_length(cc_emails_json) > 0 THEN
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || r_api_key,
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'from', r_sender,
            'to', jsonb_build_array(rec.recipient_email),
            'cc', cc_emails_json,
            'subject', r_subject,
            'html', r_html
          )
        );
      ELSE
        PERFORM net.http_post(
          url := 'https://api.resend.com/emails',
          headers := jsonb_build_object(
            'Authorization', 'Bearer ' || r_api_key,
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'from', r_sender,
            'to', jsonb_build_array(rec.recipient_email),
            'subject', r_subject,
            'html', r_html
          )
        );
      END IF;
    ELSIF r_provider = 'brevo' THEN
      DECLARE
        brevo_cc JSONB;
      BEGIN
        IF jsonb_array_length(cc_emails_json) > 0 THEN
          SELECT jsonb_agg(jsonb_build_object('email', value)) INTO brevo_cc
          FROM jsonb_array_elements_text(cc_emails_json);
          
          PERFORM net.http_post(
            url := 'https://api.brevo.com/v3/smtp/email',
            headers := jsonb_build_object(
              'api-key', r_api_key,
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
              'sender', jsonb_build_object('email', r_sender, 'name', 'Evrak Lab'),
              'to', jsonb_build_array(jsonb_build_object('email', rec.recipient_email, 'name', rec.recipient_name)),
              'cc', brevo_cc,
              'subject', r_subject,
              'htmlContent', r_html
            )
          );
        ELSE
          PERFORM net.http_post(
            url := 'https://api.brevo.com/v3/smtp/email',
            headers := jsonb_build_object(
              'api-key', r_api_key,
              'Content-Type', 'application/json'
            ),
            body := jsonb_build_object(
              'sender', jsonb_build_object('email', r_sender, 'name', 'Evrak Lab'),
              'to', jsonb_build_array(jsonb_build_object('email', rec.recipient_email, 'name', rec.recipient_name)),
              'subject', r_subject,
              'htmlContent', r_html
            )
          );
        END IF;
      END;
    END IF;
  END LOOP;
END;
$$;
