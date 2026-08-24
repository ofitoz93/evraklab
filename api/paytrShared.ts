// api/paytrShared.ts
// PayTR iFrame API için paylaşılan yardımcılar: hash üretimi, servis-rol
// Supabase istemcisi, ve satın alma "purpose"larına göre asıl aktivasyon
// mantığı. Bu dosyanın default export'u YOK — Vercel bunu bir route olarak
// algılamaz, sadece api/paytr-init.ts ve api/paytr-callback.ts tarafından
// import edilir.
//
// PayTR merchant bilgileri (PAYTR_MERCHANT_ID/KEY/SALT) henüz alınmadığı
// için bu dosya, kimlik bilgileri boşken de uygulamayı çökertmeyecek şekilde
// yazıldı — init isteği "Ödeme sistemi henüz yapılandırılmadı" hatasıyla
// nazikçe reddedilir. PayTR bilgileri .env'e girildiğinde başka hiçbir kod
// değişikliği gerekmez.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export const PAYTR_TOKEN_URL = 'https://www.paytr.com/odeme/api/get-token';

export function getPaytrCredentials() {
  const merchantId = process.env.PAYTR_MERCHANT_ID || '';
  const merchantKey = process.env.PAYTR_MERCHANT_KEY || '';
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT || '';
  const testMode = (process.env.PAYTR_TEST_MODE || '1') === '1' ? '1' : '0';
  const configured = !!(merchantId && merchantKey && merchantSalt);
  return { merchantId, merchantKey, merchantSalt, testMode, configured };
}

// Servis-rol istemcisi: RLS'yi bypass eder, sadece sunucu tarafında (bu
// dosyanın içinde) kullanılır — tarayıcıya asla gönderilmez. Bu repoda ilk
// servis-rol Supabase istemcisi (önceden hiç kullanılmamıştı).
export function createServiceClient() {
  const url = process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY veya VITE_SUPABASE_URL tanımlı değil.');
  }
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

// PayTR yalnızca [A-Za-z0-9] karakterlere izin veriyor, benzersiz olmalı.
export function generateMerchantOid(prefix: string) {
  const rand = crypto.randomBytes(6).toString('hex');
  return `${prefix}${Date.now().toString(36)}${rand}`.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// PayTR get-token isteği için imza: base64(HMAC-SHA256(merchant_id + user_ip +
// merchant_oid + email + payment_amount + user_basket + no_installment +
// max_installment + currency + test_mode + merchant_salt, merchant_key))
export function buildInitHash(params: {
  merchantId: string;
  userIp: string;
  merchantOid: string;
  email: string;
  paymentAmount: number; // kuruş
  userBasketBase64: string;
  noInstallment: string;
  maxInstallment: string;
  currency: string;
  testMode: string;
  merchantSalt: string;
  merchantKey: string;
}) {
  const hashStr =
    params.merchantId +
    params.userIp +
    params.merchantOid +
    params.email +
    params.paymentAmount +
    params.userBasketBase64 +
    params.noInstallment +
    params.maxInstallment +
    params.currency +
    params.testMode;
  return crypto
    .createHmac('sha256', params.merchantKey)
    .update(hashStr + params.merchantSalt)
    .digest('base64');
}

// PayTR bildirim (callback) hash'i: base64(HMAC-SHA256(merchant_oid +
// merchant_salt + status + total_amount, merchant_key))
export function buildCallbackHash(params: {
  merchantOid: string;
  merchantSalt: string;
  status: string;
  totalAmount: string;
  merchantKey: string;
}) {
  const hashStr = params.merchantOid + params.merchantSalt + params.status + params.totalAmount;
  return crypto.createHmac('sha256', params.merchantKey).update(hashStr).digest('base64');
}

export type PaytrPurpose =
  | 'module_purchase'
  | 'subscription_individual'
  | 'subscription_corporate_new'
  | 'subscription_corporate_renewal'
  | 'storage';

// Ödeme onaylandıktan (callback hash doğrulandıktan) SONRA çağrılır.
// Her "purpose" için Pricing.tsx/Storage.tsx/ModuleStore.tsx'in bugün
// anlık yaptığı Supabase yazımlarının birebir aynısını, servis-rol
// istemcisiyle (RLS bypass, oturum yok) sunucu tarafında tekrarlar.
export async function activatePurchase(tx: {
  id: string;
  organization_id: string | null;
  user_id: string | null;
  purpose: PaytrPurpose;
  purpose_payload: any;
  amount: number;
}) {
  const supabase = createServiceClient();
  const payload = tx.purpose_payload || {};

  if (tx.purpose === 'module_purchase') {
    const { error } = await supabase.rpc('purchase_extra_module', {
      p_organization_id: tx.organization_id,
      p_module_key: payload.moduleKey,
      p_category_key: payload.categoryKey,
      p_price: tx.amount,
      p_user_id: tx.user_id,
    });
    if (error) throw error;
    return;
  }

  if (tx.purpose === 'storage') {
    const { error } = await supabase.rpc('add_storage_limit', {
      target_id: payload.targetId,
      is_corporate: !!payload.isCorporate,
      bytes_to_add: payload.bytesToAdd,
    });
    if (error) throw error;

    await supabase.from('subscription_payments').insert({
      user_id: tx.user_id,
      organization_id: payload.isCorporate ? tx.organization_id : null,
      plan_type: 'storage',
      amount: tx.amount,
      storage_bytes: payload.bytesToAdd,
    });
    return;
  }

  if (tx.purpose === 'subscription_corporate_new') {
    const { data: newOrg, error: orgErr } = await supabase
      .from('organizations')
      .insert([
        {
          name: payload.companyName,
          member_limit: payload.targetSeats,
          subscription_end_date: payload.finalDate,
          storage_limit: 1073741824,
          is_environmental_consultant: false,
          storage_preference: payload.storageProvider || 'supabase',
        },
      ])
      .select()
      .single();
    if (orgErr) throw orgErr;

    if (payload.storageProvider === 'google_drive') {
      // Bu bildirim kullanıcının kendi sözleri DEĞİL, satın alma akışının
      // otomatik açtığı bir sistem talebi — 'message' burada set edilmiyor
      // (AdminPanel'deki "Kullanıcı (Başlangıç)" balonu koşullu olduğundan
      // boş kalır) ve ticket_messages satırı sender_role: 'system' ile
      // ekleniyor (bkz. src/AdminPanel.tsx ve src/Support.tsx'teki 'system'
      // render dalları, ve src/Pricing.tsx'teki eşdeğer client-side akış).
      const { data: driveTicket } = await supabase
        .from('tickets')
        .insert([
          {
            user_id: tx.user_id,
            subject: `Google Drive Bağlantısı Talebi - ${payload.companyName}`,
            status: 'open',
          },
        ])
        .select()
        .single();
      if (driveTicket) {
        // Bu mesaj admin'e değil doğrudan kullanıcıya hitap eder. Bağlantı
        // artık öncelikle kullanıcının kendi panelinden (Ayarlar > Depolama
        // Ayarları) self-servis olarak tamamlanıyor — bkz.
        // src/ConsultantPanel.tsx > 'storage_settings' tab. Bu talep, admin'e
        // bilgi vermek ve kullanıcı takılırsa bir yedek kanal olması için
        // açılıyor.
        await supabase.from('ticket_messages').insert([
          {
            ticket_id: driveTicket.id,
            sender_role: 'system',
            message: `"${payload.companyName}" firması için depolama sağlayıcısı olarak Google Drive seçildi. Bağlantıyı Yönetici Panelinizde "Ayarlar > Depolama Ayarları" sekmesinden kendiniz tamamlayabilirsiniz — orada Google Client ID / Client Secret alanları ve adım adım rehber hazır bekliyor. Bağlantı tamamlanana kadar bu firma belge yükleyemez. Kendiniz tamamlayamazsanız bu talebe yanıt yazın, ekibimiz size yardımcı olsun.`,
          },
        ]);
      }
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ role: 'premium_corporate', organization_id: newOrg.id, subscription_end_date: null })
      .eq('id', tx.user_id);
    if (profErr) throw profErr;

    await supabase.from('subscription_payments').insert({
      user_id: tx.user_id,
      organization_id: newOrg.id,
      plan_type: 'corporate_new',
      amount: tx.amount,
      duration_months: payload.durationMonths,
      seats: payload.targetSeats,
    });
    return;
  }

  if (tx.purpose === 'subscription_corporate_renewal') {
    const { error: orgErr } = await supabase
      .from('organizations')
      .update({ member_limit: payload.targetSeats, subscription_end_date: payload.finalDate })
      .eq('id', tx.organization_id);
    if (orgErr) throw orgErr;

    await supabase.rpc('restore_org_roles', { org_id: tx.organization_id });

    await supabase.from('subscription_payments').insert({
      user_id: tx.user_id,
      organization_id: tx.organization_id,
      plan_type: 'corporate_renewal',
      amount: tx.amount,
      duration_months: payload.durationMonths,
      seats: payload.targetSeats,
    });
    return;
  }

  if (tx.purpose === 'subscription_individual') {
    let personalOrgId: string | null = payload.existingOrganizationId || null;
    const isFirstPersonalOrg = !personalOrgId;

    if (isFirstPersonalOrg) {
      const { data: newPersonalOrg, error: personalOrgErr } = await supabase
        .from('organizations')
        .insert([{ name: payload.personalName, member_limit: 1, is_environmental_consultant: false, is_personal: true }])
        .select()
        .single();
      if (personalOrgErr) throw personalOrgErr;
      personalOrgId = newPersonalOrg.id;
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ role: 'premium_individual', organization_id: personalOrgId, subscription_end_date: payload.finalDate })
      .eq('id', tx.user_id);
    if (profErr) throw profErr;

    if (isFirstPersonalOrg) {
      const { error: personalClientErr } = await supabase
        .from('consultant_clients')
        .insert([{ consultant_company_id: personalOrgId, name: 'Lokasyon 1' }]);
      if (personalClientErr) throw personalClientErr;

      const { error: personalLocDefErr } = await supabase
        .from('user_definitions')
        .insert([{ user_id: tx.user_id, category: 'location', label: 'Lokasyon 1', organization_id: personalOrgId }]);
      if (personalLocDefErr) throw personalLocDefErr;
    }

    await supabase.from('subscription_payments').insert({
      user_id: tx.user_id,
      organization_id: personalOrgId,
      plan_type: 'individual',
      amount: tx.amount,
      duration_months: payload.durationMonths,
    });
    return;
  }

  throw new Error(`Bilinmeyen satın alma amacı: ${tx.purpose}`);
}
