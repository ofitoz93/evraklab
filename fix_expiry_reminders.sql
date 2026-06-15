-- ==========================================================
-- CREATE EMAIL SETTINGS & LOGS TABLES & REMINDERS FUNCTION
-- ==========================================================

-- Enable pg_net extension for HTTP requests (needed for pg_net.http_post)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 1. Create email_settings table
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

-- 2. Create email_logs table
CREATE TABLE IF NOT EXISTS public.email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    subject TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent', 'expired'
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can manage email settings" ON public.email_settings;
DROP POLICY IF EXISTS "Admins can view email logs" ON public.email_logs;
DROP POLICY IF EXISTS "Allow public select of system logo url" ON public.email_settings;

-- 4. Create RLS Policies
CREATE POLICY "Admins can manage email settings" ON public.email_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "Allow public select of system logo url" ON public.email_settings
FOR SELECT TO public USING (key = 'system_logo_url');

CREATE POLICY "Admins can view email logs" ON public.email_logs
FOR SELECT TO authenticated USING (public.is_admin());

-- 5. Create PL/pgSQL send_expiry_reminders function
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

-- 6. Schedule daily cron job (runs every day at 06:00 UTC, which is 09:00 Turkey Local Time)
-- NOTE: Requires pg_cron extension to be enabled in Supabase.
CREATE EXTENSION IF NOT EXISTS pg_cron;
-- Unschedule if exists to avoid duplicate schedules
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'send-expiry-reminders-daily';
SELECT cron.schedule('send-expiry-reminders-daily', '0 6 * * *', 'SELECT public.send_expiry_reminders();');
