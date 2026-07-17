-- ==========================================================
-- send_client_contract_reminders'ı dönem-farkında hale getirir.
-- Artık sözleşme bitiş tarihi "service_start_date + 1 yıl" sabit
-- varsayımı yerine, o firmanın en güncel consultant_client_service_periods
-- satırının end_date'inden okunur (add_consultant_client_service_periods.sql).
-- Henüz hiç dönemi olmayan (beklenmeyen/eski veri) firmalar için eski
-- hesaba (service_start_date + 1 yıl) geri düşülür - davranış hiçbir zaman
-- "sessizce hiç hatırlatma göndermemek" olmasın diye.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.send_client_contract_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec RECORD;
  client_rec RECORD;
  r_provider TEXT;
  r_api_key TEXT;
  r_sender TEXT;
  r_script_url TEXT;
  r_subject TEXT;
  r_html TEXT;
  r_rows TEXT;
  r_status_badge TEXT;
BEGIN
  -- Get SMTP settings
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

  -- Loop through all owners and chiefs who have clients expiring in <= 10 days or already expired
  FOR rec IN
    SELECT DISTINCT
      p.id AS recipient_id,
      p.email AS recipient_email,
      p.full_name AS recipient_name,
      p.organization_id AS org_id
    FROM public.profiles p
    JOIN public.consultant_clients cc ON cc.consultant_company_id = p.organization_id
    LEFT JOIN LATERAL (
      SELECT end_date FROM public.consultant_client_service_periods sp
      WHERE sp.client_id = cc.id ORDER BY sp.start_date DESC LIMIT 1
    ) latest_period ON TRUE
    WHERE p.role IN ('premium_corporate', 'corporate_chief')
      AND cc.service_start_date IS NOT NULL
      -- Expiring in <= 10 days or already expired (dönem varsa dönemin bitişi, yoksa eski 1 yıl varsayımı)
      AND (COALESCE(latest_period.end_date, (cc.service_start_date + INTERVAL '1 year')::date) - CURRENT_DATE) <= 10
  LOOP
    r_rows := '';
    FOR client_rec IN
      SELECT
        cc.name AS client_name,
        cc.service_start_date,
        COALESCE(latest_period.end_date, (cc.service_start_date + INTERVAL '1 year')::date) AS expiry_date,
        (COALESCE(latest_period.end_date, (cc.service_start_date + INTERVAL '1 year')::date) - CURRENT_DATE) AS days_remaining
      FROM public.consultant_clients cc
      LEFT JOIN LATERAL (
        SELECT end_date FROM public.consultant_client_service_periods sp
        WHERE sp.client_id = cc.id ORDER BY sp.start_date DESC LIMIT 1
      ) latest_period ON TRUE
      WHERE cc.consultant_company_id = rec.org_id
        AND cc.service_start_date IS NOT NULL
        AND (COALESCE(latest_period.end_date, (cc.service_start_date + INTERVAL '1 year')::date) - CURRENT_DATE) <= 10
      ORDER BY (COALESCE(latest_period.end_date, (cc.service_start_date + INTERVAL '1 year')::date) - CURRENT_DATE) ASC
    LOOP
      -- Status badge formatting
      IF client_rec.days_remaining <= 0 THEN
        r_status_badge := '<span style="display: inline-block; background-color: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fca5a5; white-space: nowrap;">⚠️ Süresi Geçti (' || abs(client_rec.days_remaining) || ' Gün)</span>';
      ELSE
        r_status_badge := '<span style="display: inline-block; background-color: #fef3c7; color: #92400e; padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 700; border: 1px solid #fcd34d; white-space: nowrap;">⏳ ' || client_rec.days_remaining || ' Gün Kaldı</span>';
      END IF;

      r_rows := r_rows || '<tr style="background-color: #ffffff;">' ||
                '<td style="padding: 14px 16px; font-weight: 700; color: #0f172a; font-size: 13px; border-bottom: 1px solid #f1f5f9; line-height: 1.4;">' || COALESCE(client_rec.client_name, '') || '</td>' ||
                '<td style="padding: 14px 16px; color: #475569; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">' || to_char(client_rec.service_start_date, 'DD.MM.YYYY') || '</td>' ||
                '<td style="padding: 14px 16px; color: #475569; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">' || to_char(client_rec.expiry_date, 'DD.MM.YYYY') || '</td>' ||
                '<td style="padding: 14px 16px; text-align: right; border-bottom: 1px solid #f1f5f9;">' || r_status_badge || '</td>' ||
                '</tr>';
    END LOOP;

    r_subject := 'Evrak Lab - İşletme Hizmet Sözleşmesi Süre Uyarısı';

    r_html := '<div style="background-color: #f1f5f9; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, ''Helvetica Neue'', Arial, sans-serif;">' ||
              '<div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">' ||
              '<div style="background: linear-gradient(135deg, #0e2a47 0%, #1e40af 100%); padding: 32px 24px; text-align: center; color: #ffffff;">' ||
              '<div style="font-size: 28px; font-weight: 800; letter-spacing: -0.025em; margin-bottom: 4px;">Evrak<span style="color: #60a5fa;">LAB</span></div>' ||
              '<div style="font-size: 14px; opacity: 0.9; font-weight: 500;">Hizmet Sözleşmeleri Süre Hatırlatma Servisi</div>' ||
              '</div>' ||
              '<div style="padding: 32px 24px; background-color: #ffffff;">' ||
              '<h3 style="margin-top: 0; font-size: 18px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">Sayın ' || COALESCE(NULLIF(rec.recipient_name, ''), SPLIT_PART(rec.recipient_email, '@', 1)) || ',</h3>' ||
              '<p style="font-size: 14px; color: #475569; line-height: 1.6; margin-bottom: 24px;">Hizmet verdiğiniz aşağıdaki işletmelerin sözleşme sürelerinin dolmasına 10 günden az kalmış veya süreleri dolmuştur. İşletmelerin hizmet sürelerinin kesintiye uğramaması için gerekli sözleşme yenileme işlemlerini yapmanızı rica ederiz.</p>' ||
              '<table style="width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 16px; margin-bottom: 24px; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">' ||
              '<thead>' ||
              '<tr style="background-color: #f8fafc;">' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">İşletme Adı</th>' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Başlangıç</th>' ||
              '<th style="padding: 14px 16px; text-align: left; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Bitiş Tarihi</th>' ||
              '<th style="padding: 14px 16px; text-align: right; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0;">Durum</th>' ||
              '</tr>' ||
              '</thead>' ||
              '<tbody>' ||
              r_rows ||
              '</tbody>' ||
              '</table>' ||
              '<div style="margin-top: 32px; padding: 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; text-align: center;">' ||
              '<div style="font-size: 13px; color: #475569; margin-bottom: 14px; line-height: 1.5;">' ||
              'İşletme sözleşmelerini ve sürelerini yönetmek için EvrakLAB danışman paneline giriş yapabilirsiniz.' ||
              '</div>' ||
              '<a href="https://evraklab.com" style="display: inline-block; background: linear-gradient(135deg, #0e2a47 0%, #1e40af 100%); color: #ffffff; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; box-shadow: 0 4px 12px rgba(14, 42, 71, 0.2); transition: all 0.2s ease;">EvrakLAB Paneline Git</a>' ||
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
          'subject', r_subject,
          'html', r_html
        )
      );
    ELSIF r_provider = 'resend' THEN
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
    ELSIF r_provider = 'brevo' THEN
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
  END LOOP;
END;
$$;
