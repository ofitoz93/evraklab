-- ==========================================
-- FIX FOR SUPPORT TICKETS RLS POLICIES
-- ==========================================

-- 1. Enable Row Level Security (RLS) on tickets and ticket_messages
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to prevent conflicts
DROP POLICY IF EXISTS "Users can view own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can insert own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can update own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Admins can manage all tickets" ON public.tickets;

DROP POLICY IF EXISTS "Users can view messages for own tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Users can insert messages for own tickets" ON public.ticket_messages;
DROP POLICY IF EXISTS "Admins can manage all ticket messages" ON public.ticket_messages;

-- 3. Create Policies for tickets table

-- Users can view their own tickets OR admins can view all tickets
CREATE POLICY "Users can view own tickets" ON public.tickets
FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_admin());

-- Users can create/insert their own tickets (user_id must match auth.uid())
CREATE POLICY "Users can insert own tickets" ON public.tickets
FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Users can update their own tickets (e.g. marking unread messages as read) OR admins can update all tickets
CREATE POLICY "Users can update own tickets" ON public.tickets
FOR UPDATE TO authenticated USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Admins/system admins have full control over all tickets
CREATE POLICY "Admins can manage all tickets" ON public.tickets
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4. Create Policies for ticket_messages table

-- Users can view messages associated with their own tickets OR admins can view all messages
CREATE POLICY "Users can view messages for own tickets" ON public.ticket_messages
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

-- Users can insert messages to their own tickets OR admins can insert messages
CREATE POLICY "Users can insert messages for own tickets" ON public.ticket_messages
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tickets
    WHERE id = ticket_messages.ticket_id
    AND (user_id = auth.uid() OR public.is_admin())
  )
);

-- Admins/system admins have full control over all ticket messages
CREATE POLICY "Admins can manage all ticket messages" ON public.ticket_messages
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
