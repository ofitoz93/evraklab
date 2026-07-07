-- ==========================================================
-- PREMIUM KOLTUK KOTASI (premium_seat_limit)
--
-- Önceki hediye kodu sistemi sadece kod kullanıldığı ANDAKİ personel
-- sayısına göre premium_seat_active'i bir kereliğine ayarlıyordu.
-- Ama "3 kişilik" bir kod alındığında şirkette henüz 1 kişi varsa,
-- daha sonra eklenecek 2. ve 3. personelin de otomatik olarak premium
-- olması gerekiyor - bunun için kalıcı bir "kaç koltuk premium"
-- bilgisinin saklanması lazım.
--
-- 1) organizations.premium_seat_limit: bu organizasyonun kaç premium
--    koltuğu olduğunu tutar. NULL = hiç kurumsal hediye kodu
--    kullanılmamış / koltuk sınırı yok (mevcut/eski kurumsal hesaplar
--    için geriye dönük uyumluluk - herkes premium kalmaya devam eder,
--    hiçbir şey değişmez).
--
-- 2) enforce_premium_seat_quota() trigger'ı (profiles tablosu,
--    organization_id veya premium_seat_active değiştiğinde):
--    - Bir kullanıcı organizasyona YENİ katıldığında (invitations kabul,
--      admin panelinden şirkete atama vb.) organizasyonun kotasına göre
--      otomatik premium_seat_active atar (kota doluysa false, boşsa true,
--      limit yoksa true - mevcut davranış).
--    - Şirket sahibi Ekip Yönetimi sayfasından bir personelin premium'unu
--      manuel AÇMAYA çalışırsa ve kota doluysa hatayla reddeder.
--    - redeem_gift_code() içindeki toplu güncellemeler kendi mantığını
--      zaten doğruladığı için, bu fonksiyon içinde
--      app.skip_seat_quota_check bayrağıyla devre dışı bırakılır.
--
-- 3) preview_gift_code / redeem_gift_code: artık ham kod koltuk sayısı
--    yerine kümülatif (GREATEST ile büyütülen, hiç küçültülmeyen)
--    premium_seat_limit'i kullanıyor - böylece küçük bir yenileme kodu,
--    önceden geniş bir kotaya sahip şirketi yanlışlıkla küçültüp
--    gereksiz koltuk seçim ekranı açmıyor.
-- ==========================================================

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS premium_seat_limit INTEGER;

CREATE OR REPLACE FUNCTION public.enforce_premium_seat_quota()
RETURNS TRIGGER AS $$
DECLARE
  v_limit INTEGER;
  v_active_count INTEGER;
  v_org_changed BOOLEAN;
BEGIN
  IF current_setting('app.skip_seat_quota_check', true) = 'true' THEN
    RETURN NEW;
  END IF;

  v_org_changed := NEW.organization_id IS NOT NULL AND (
    TG_OP = 'INSERT' OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
  );

  IF v_org_changed THEN
    -- Organizasyona yeni katılım: kotaya göre otomatik ata
    SELECT premium_seat_limit INTO v_limit FROM public.organizations WHERE id = NEW.organization_id;
    IF v_limit IS NULL THEN
      NEW.premium_seat_active := true;
    ELSE
      SELECT COUNT(*) INTO v_active_count FROM public.profiles
      WHERE organization_id = NEW.organization_id AND premium_seat_active = true AND id <> NEW.id;
      NEW.premium_seat_active := (v_active_count < v_limit);
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.premium_seat_active = true AND OLD.premium_seat_active = false
        AND NEW.organization_id IS NOT NULL THEN
    -- Manuel olarak premium acilirken kota kontrolu
    SELECT premium_seat_limit INTO v_limit FROM public.organizations WHERE id = NEW.organization_id;
    IF v_limit IS NOT NULL THEN
      SELECT COUNT(*) INTO v_active_count FROM public.profiles
      WHERE organization_id = NEW.organization_id AND premium_seat_active = true AND id <> NEW.id;
      IF v_active_count >= v_limit THEN
        RAISE EXCEPTION 'Premium kota dolu (%/%). Önce başka bir personelin premium özelliğini kapatmalısınız.', v_active_count, v_limit;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_premium_seat_quota_trigger ON public.profiles;
CREATE TRIGGER enforce_premium_seat_quota_trigger
BEFORE INSERT OR UPDATE OF organization_id, premium_seat_active ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_premium_seat_quota();

CREATE OR REPLACE FUNCTION public.preview_gift_code(code_input TEXT)
RETURNS JSONB AS $$
DECLARE
  v_code public.premium_gift_codes%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_effective_role TEXT;
  v_member_count INTEGER;
  v_current_limit INTEGER;
  v_new_limit INTEGER;
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

  SELECT premium_seat_limit INTO v_current_limit FROM public.organizations WHERE id = v_profile.organization_id;
  v_new_limit := GREATEST(COALESCE(v_current_limit, 0), v_code.seats);

  IF v_member_count <= v_new_limit THEN
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
    'seats', v_new_limit,
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
  v_current_limit INTEGER;
  v_new_limit INTEGER;
  v_new_org_id UUID;
  v_new_end TIMESTAMP WITH TIME ZONE;
BEGIN
  PERFORM set_config('app.skip_seat_quota_check', 'true', true);

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

    INSERT INTO public.organizations (name, member_limit, subscription_end_date, is_personal, premium_seat_limit)
    VALUES (TRIM(new_company_name), v_code.seats, NOW() + (v_code.duration_months || ' months')::interval, false, v_code.seats)
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

  SELECT premium_seat_limit INTO v_current_limit FROM public.organizations WHERE id = v_profile.organization_id;
  v_new_limit := GREATEST(COALESCE(v_current_limit, 0), v_code.seats);

  SELECT GREATEST(NOW(), COALESCE(subscription_end_date, NOW())) + (v_code.duration_months || ' months')::interval
  INTO v_new_end
  FROM public.organizations WHERE id = v_profile.organization_id;

  IF v_member_count <= v_new_limit THEN
    UPDATE public.organizations
    SET subscription_end_date = v_new_end,
        member_limit = GREATEST(member_limit, v_new_limit),
        premium_seat_limit = v_new_limit
    WHERE id = v_profile.organization_id;

    UPDATE public.profiles
    SET premium_seat_active = true
    WHERE organization_id = v_profile.organization_id;
  ELSE
    IF selected_seat_ids IS NULL OR array_length(selected_seat_ids, 1) <> v_new_limit THEN
      RAISE EXCEPTION 'Tam olarak % kişi seçmelisiniz.', v_new_limit;
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
    SET subscription_end_date = v_new_end,
        premium_seat_limit = v_new_limit
    WHERE id = v_profile.organization_id;

    UPDATE public.profiles
    SET premium_seat_active = (id = ANY(selected_seat_ids))
    WHERE organization_id = v_profile.organization_id;
  END IF;

  PERFORM public.restore_org_roles(v_profile.organization_id);

  UPDATE public.premium_gift_codes
  SET status = 'redeemed', redeemed_by = auth.uid(), redeemed_at = NOW(), organization_id = v_profile.organization_id
  WHERE id = v_code.id;

  RETURN jsonb_build_object('status', 'success', 'type', 'corporate', 'organization_id', v_profile.organization_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
