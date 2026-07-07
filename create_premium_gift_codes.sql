-- ==========================================================
-- HEDİYE KODU (PREMIUM GIFT CODE) SİSTEMİ
-- Supabase SQL Editor'de çalıştırın
--
-- Admin panelinden süreli premium kodu (Bireysel 1/3/6/12 Ay veya
-- Kurumsal N Kişilik X Ay) oluşturulur, kullanıcı Ayarlar sayfasından
-- kodu girip kullanır:
-- - Bireysel kod: sadece hiçbir şirkete bağlı olmayan kullanıcılar
--   kullanabilir, kendi subscription_end_date'ini uzatır.
-- - Kurumsal kod: şirketi olmayan kullanıcı yeni şirket kurar; mevcut
--   şirket sahibi (premium_corporate) kendi şirketine uygular; şirket
--   personeli/yöneticisi (sahip değilse) kodu KULLANAMAZ. Mevcut
--   şirkette kişi sayısı kod kapasitesinden fazlaysa, sahip dahil
--   olmak üzere hangi kişilerde premium'un devam edeceği zorunlu
--   olarak seçilir (premium_seat_active bayrağı ile).
--
-- Tüm redemption mantığı iki SECURITY DEFINER fonksiyonda toplanır
-- (preview_gift_code: salt okunur ön kontrol, redeem_gift_code: asıl
-- mutasyon) - kullanıcılar premium_gift_codes tablosuna doğrudan
-- erişemez, sadece admin (is_admin()) erişebilir.
-- ==========================================================

-- 1. Kod tablosu
CREATE TABLE IF NOT EXISTS public.premium_gift_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('individual','corporate')),
    duration_months INTEGER NOT NULL CHECK (duration_months > 0),
    seats INTEGER CHECK (seats IS NULL OR seats > 0),
    status TEXT NOT NULL DEFAULT 'unused' CHECK (status IN ('unused','redeemed','revoked')),
    note TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    redeemed_at TIMESTAMP WITH TIME ZONE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.premium_gift_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage gift codes" ON public.premium_gift_codes;
CREATE POLICY "Admins manage gift codes" ON public.premium_gift_codes
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 2. Kurumsal hesaplarda kişi bazlı premium bayrağı
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS premium_seat_active BOOLEAN NOT NULL DEFAULT true;

-- 3. Ön kontrol (salt okunur) - kodun ne yapacağını, hangi ek bilgi
--    gerektiğini (şirket adı / koltuk seçimi) döndürür, hiçbir şeyi
--    değiştirmez.
CREATE OR REPLACE FUNCTION public.preview_gift_code(code_input TEXT)
RETURNS JSONB AS $$
DECLARE
  v_code public.premium_gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member_count INTEGER;
  v_members JSONB;
BEGIN
  SELECT * INTO v_code FROM public.premium_gift_codes
  WHERE code = UPPER(TRIM(code_input));

  IF v_code.id IS NULL OR v_code.status <> 'unused' THEN
    RAISE EXCEPTION 'Geçersiz veya kullanılmış kod.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_code.type = 'individual' THEN
    IF v_profile.organization_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bu kodu kullanmak için bir şirkete bağlı olmamanız gerekir.';
    END IF;
    RETURN jsonb_build_object(
      'action', 'direct',
      'type', 'individual',
      'duration_months', v_code.duration_months
    );
  END IF;

  -- type = 'corporate'
  IF v_profile.organization_id IS NOT NULL AND v_profile.role <> 'premium_corporate' THEN
    RAISE EXCEPTION 'Bu kodu sadece şirket sahibi kullanabilir.';
  END IF;

  IF v_profile.organization_id IS NULL THEN
    RETURN jsonb_build_object(
      'action', 'needs_company_name',
      'type', 'corporate',
      'seats', v_code.seats,
      'duration_months', v_code.duration_months
    );
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM public.profiles WHERE organization_id = v_profile.organization_id;

  IF v_member_count <= v_code.seats THEN
    RETURN jsonb_build_object(
      'action', 'direct',
      'type', 'corporate',
      'seats', v_code.seats,
      'duration_months', v_code.duration_months
    );
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'id', p.id, 'full_name', p.full_name, 'email', p.email, 'role', p.role
  ) ORDER BY (p.id = auth.uid()) DESC, p.full_name)
  INTO v_members
  FROM public.profiles p
  WHERE p.organization_id = v_profile.organization_id;

  RETURN jsonb_build_object(
    'action', 'needs_seat_selection',
    'type', 'corporate',
    'seats', v_code.seats,
    'duration_months', v_code.duration_months,
    'members', v_members
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Asıl redemption (mutasyon) - preview'a güvenmeden tüm kontrolleri
--    tekrar yapar, kodu satır kilidiyle (FOR UPDATE) tek seferlik
--    tüketilmesini garanti eder.
CREATE OR REPLACE FUNCTION public.redeem_gift_code(
  code_input TEXT,
  new_company_name TEXT DEFAULT NULL,
  selected_seat_ids UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_code public.premium_gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_member_count INTEGER;
  v_new_org_id UUID;
  v_new_end TIMESTAMP WITH TIME ZONE;
BEGIN
  SELECT * INTO v_code FROM public.premium_gift_codes
  WHERE code = UPPER(TRIM(code_input))
  FOR UPDATE;

  IF v_code.id IS NULL OR v_code.status <> 'unused' THEN
    RAISE EXCEPTION 'Geçersiz veya kullanılmış kod.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();

  IF v_code.type = 'individual' THEN
    IF v_profile.organization_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bu kodu kullanmak için bir şirkete bağlı olmamanız gerekir.';
    END IF;

    UPDATE public.profiles
    SET role = 'premium_individual',
        subscription_end_date = GREATEST(NOW(), COALESCE(subscription_end_date, NOW()))
                                 + (v_code.duration_months || ' months')::interval
    WHERE id = auth.uid();

    UPDATE public.premium_gift_codes
    SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW()
    WHERE id = v_code.id;

    RETURN jsonb_build_object('status', 'success', 'type', 'individual');
  END IF;

  -- type = 'corporate'
  IF v_profile.organization_id IS NOT NULL AND v_profile.role <> 'premium_corporate' THEN
    RAISE EXCEPTION 'Bu kodu sadece şirket sahibi kullanabilir.';
  END IF;

  IF v_profile.organization_id IS NULL THEN
    IF new_company_name IS NULL OR TRIM(new_company_name) = '' THEN
      RAISE EXCEPTION 'Şirket adı gereklidir.';
    END IF;

    INSERT INTO public.organizations (name, member_limit, subscription_end_date, is_personal)
    VALUES (TRIM(new_company_name), v_code.seats, NOW() + (v_code.duration_months || ' months')::interval, false)
    RETURNING id INTO v_new_org_id;

    UPDATE public.profiles
    SET organization_id = v_new_org_id,
        role = 'premium_corporate',
        premium_seat_active = true
    WHERE id = auth.uid();

    UPDATE public.premium_gift_codes
    SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW(), organization_id = v_new_org_id
    WHERE id = v_code.id;

    RETURN jsonb_build_object('status', 'success', 'type', 'corporate', 'organization_id', v_new_org_id);
  END IF;

  -- Mevcut şirket sahibi kodu kendi şirketine uyguluyor
  SELECT COUNT(*) INTO v_member_count
  FROM public.profiles WHERE organization_id = v_profile.organization_id;

  SELECT GREATEST(NOW(), COALESCE(subscription_end_date, NOW())) + (v_code.duration_months || ' months')::interval
  INTO v_new_end
  FROM public.organizations WHERE id = v_profile.organization_id;

  IF v_member_count <= v_code.seats THEN
    UPDATE public.organizations
    SET subscription_end_date = v_new_end,
        member_limit = GREATEST(member_limit, v_code.seats)
    WHERE id = v_profile.organization_id;

    UPDATE public.profiles
    SET premium_seat_active = true
    WHERE organization_id = v_profile.organization_id;
  ELSE
    IF selected_seat_ids IS NULL OR array_length(selected_seat_ids, 1) <> v_code.seats THEN
      RAISE EXCEPTION 'Tam olarak % kişi seçmelisiniz.', v_code.seats;
    END IF;

    IF NOT (auth.uid() = ANY(selected_seat_ids)) THEN
      RAISE EXCEPTION 'Şirket sahibi seçim dışında bırakılamaz.';
    END IF;

    IF EXISTS (
      SELECT 1 FROM unnest(selected_seat_ids) AS sid
      WHERE NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = sid AND organization_id = v_profile.organization_id
      )
    ) THEN
      RAISE EXCEPTION 'Seçilen kişilerden biri bu şirkete ait değil.';
    END IF;

    UPDATE public.organizations
    SET subscription_end_date = v_new_end
    WHERE id = v_profile.organization_id;

    UPDATE public.profiles
    SET premium_seat_active = (id = ANY(selected_seat_ids))
    WHERE organization_id = v_profile.organization_id;
  END IF;

  UPDATE public.premium_gift_codes
  SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW(), organization_id = v_profile.organization_id
  WHERE id = v_code.id;

  RETURN jsonb_build_object('status', 'success', 'type', 'corporate', 'organization_id', v_profile.organization_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
