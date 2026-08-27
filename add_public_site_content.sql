-- ==========================================================
-- PUBLIC MARKETING SITE: contact settings + contact form + public pricing read
-- ==========================================================
-- Adds admin-editable contact info (shown on the public /iletisim page),
-- a public contact_messages inbox, and opens read-only anonymous access to
-- the pricing figures (subscription_plans, storage_pricing) so the public
-- /fiyatlandirma page can stay in sync with what admins configure.

-- 1. Contact info keys on the existing email_settings key/value table
INSERT INTO public.email_settings (key, value) VALUES
  ('contact_email', ''),
  ('contact_phone', ''),
  ('contact_address', '')
ON CONFLICT (key) DO NOTHING;

-- Widen the existing "public logo" read policy to cover the new public keys too
DROP POLICY IF EXISTS "Allow public select of system logo url" ON public.email_settings;
DROP POLICY IF EXISTS "Allow public select of public site settings" ON public.email_settings;
CREATE POLICY "Allow public select of public site settings" ON public.email_settings
FOR SELECT TO public USING (key IN ('system_logo_url', 'contact_email', 'contact_phone', 'contact_address'));

-- 2. pricing_settings currently only readable by authenticated users; open just
--    the pricing-relevant keys (not e.g. default_system_modules) to anon so the
--    public pricing page can render without a session.
DROP POLICY IF EXISTS "Allow public select of public pricing keys" ON public.pricing_settings;
CREATE POLICY "Allow public select of public pricing keys" ON public.pricing_settings
FOR SELECT TO public USING (key IN ('subscription_plans', 'storage_pricing'));

-- 3. Public contact form submissions
CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    message TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can submit a contact message" ON public.contact_messages;
CREATE POLICY "Anyone can submit a contact message" ON public.contact_messages
FOR INSERT TO public WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can manage contact messages" ON public.contact_messages;
CREATE POLICY "Admins can manage contact messages" ON public.contact_messages
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
