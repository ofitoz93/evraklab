-- ==========================================================
-- HEDİYE KODU: SÜRESİ DOLMUŞ ŞİRKET SAHİBİ KODU KULLANAMIYORDU
--
-- check_and_downgrade_subscriptions() süresi dolan kurumsal hesapları
-- role='normal' yapıp previous_role'a eski rolü kaydediyor (bkz.
-- fix_role_restore_on_renewal.sql) - organization_id ise SİLİNMİYOR.
-- preview_gift_code/redeem_gift_code sahiplik kontrolünü sadece
-- role = 'premium_corporate' olarak yaptığı için, süresi dolmuş
-- (role='normal' olmuş) gerçek şirket sahibi "Bu kodu sadece şirket
-- sahibi kullanabilir" hatası alıyordu.
--
-- Düzeltme:
-- 1) Sahiplik kontrolü artık role='normal' + previous_role='premium_corporate'
--    durumunu da sahip olarak kabul ediyor (previous_role fallback).
-- 2) Mevcut şirkete kod uygulanıp (yenilenip) süre uzatıldığında,
--    Pricing.tsx'in zaten kullandığı restore_org_roles() çağrılarak
--    süresi dolmuş TÜM personelin (sahip dahil) rolü otomatik geri
--    yükleniyor - elle "önce Pricing sayfasından yenile, sonra kodu
--    kullan" gibi bir ek adım gerekmiyor.
-- ==========================================================

CREATE OR REPLACE FUNCTION public.preview_gift_code(code_input TEXT)
RETURNS JSONB AS $$
DECLARE
  v_code public.premium_gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_effective_role TEXT;
  v_member_count INTEGER;
  v_members JSONB;
BEGIN
  SELECT * INTO v_code FROM public.premium_gift_codes
  WHERE code = UPPER(TRIM(code_input));

  IF v_code.id IS NULL OR v_code.status <> 'unused' THEN
    RAISE EXCEPTION 'Geçersiz veya kullanılmış kod.';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  v_effective_role := CASE
    WHEN v_profile.role = 'normal' AND v_profile.previous_role IS NOT NULL THEN v_profile.previous_role
    ELSE v_profile.role
  END;

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
  IF v_profile.organization_id IS NOT NULL AND v_effective_role <> 'premium_corporate' THEN
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

CREATE OR REPLACE FUNCTION public.redeem_gift_code(
  code_input TEXT,
  new_company_name TEXT DEFAULT NULL,
  selected_seat_ids UUID[] DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_code public.premium_gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_effective_role TEXT;
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
  v_effective_role := CASE
    WHEN v_profile.role = 'normal' AND v_profile.previous_role IS NOT NULL THEN v_profile.previous_role
    ELSE v_profile.role
  END;

  IF v_code.type = 'individual' THEN
    IF v_profile.organization_id IS NOT NULL THEN
      RAISE EXCEPTION 'Bu kodu kullanmak için bir şirkete bağlı olmamanız gerekir.';
    END IF;

    UPDATE public.profiles
    SET role = 'premium_individual',
        previous_role = NULL,
        subscription_end_date = GREATEST(NOW(), COALESCE(subscription_end_date, NOW()))
                                 + (v_code.duration_months || ' months')::interval
    WHERE id = auth.uid();

    UPDATE public.premium_gift_codes
    SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW()
    WHERE id = v_code.id;

    RETURN jsonb_build_object('status', 'success', 'type', 'individual');
  END IF;

  -- type = 'corporate'
  IF v_profile.organization_id IS NOT NULL AND v_effective_role <> 'premium_corporate' THEN
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
        previous_role = NULL,
        premium_seat_active = true
    WHERE id = auth.uid();

    UPDATE public.premium_gift_codes
    SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW(), organization_id = v_new_org_id
    WHERE id = v_code.id;

    RETURN jsonb_build_object('status', 'success', 'type', 'corporate', 'organization_id', v_new_org_id);
  END IF;

  -- Mevcut şirket sahibi kodu kendi şirketine uyguluyor (süresi dolmuş olsa bile)
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

  -- Şirket süresi daha önce dolup personel/şef/sahip 'normal'a düşürülmüşse
  -- (previous_role saklanmıştı), yenileme sonrası rollerini geri yükle.
  PERFORM public.restore_org_roles(v_profile.organization_id);

  UPDATE public.premium_gift_codes
  SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW(), organization_id = v_profile.organization_id
  WHERE id = v_code.id;

  RETURN jsonb_build_object('status', 'success', 'type', 'corporate', 'organization_id', v_profile.organization_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
