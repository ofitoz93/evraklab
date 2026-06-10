-- ==========================================
-- FIX FOR TEAM CHAT & INVITE CODE SYSTEM
-- ==========================================

-- 1. Modify invitations & notifications tables to support invitation codes and request metadata
ALTER TABLE public.invitations ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.invitations ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Enable Row Level Security (RLS) on Chat and Invitation tables
ALTER TABLE public.company_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies to prevent conflicts
DROP POLICY IF EXISTS "Allow users to read messages in their organization" ON public.company_messages;
DROP POLICY IF EXISTS "Allow users to send messages in their organization" ON public.company_messages;
DROP POLICY IF EXISTS "Allow users to manage their own message reads" ON public.message_reads;
DROP POLICY IF EXISTS "Allow users to manage their own chat settings" ON public.chat_settings;
DROP POLICY IF EXISTS "Allow users to select invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow managers to insert invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow managers to delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow managers to update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Allow users to read own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow authenticated to insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Allow users to delete own notifications" ON public.notifications;

-- 4. Create Policies for company_messages
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

-- 5. Create Policies for message_reads
CREATE POLICY "Allow users to manage their own message reads" ON public.message_reads
FOR ALL TO authenticated USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

-- 6. Create Policies for chat_settings
CREATE POLICY "Allow users to manage their own chat settings" ON public.chat_settings
FOR ALL TO authenticated USING (
  user_id = auth.uid()
) WITH CHECK (
  user_id = auth.uid()
);

-- 7. Create Policies for invitations
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

-- 8. Create Policies for notifications
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

-- 9. Create Policies for profiles (Allow managers to add users to their company)
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
