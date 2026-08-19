// api/paytr-init.ts
import { getPaytrCredentials, createServiceClient, generateMerchantOid, buildInitHash, PAYTR_TOKEN_URL, PaytrPurpose } from './paytrShared';

interface PaytrInitInput {
  organizationId: string | null;
  userId: string;
  purpose: PaytrPurpose;
  purposePayload: any;
  amount: number; // TL
  itemLabel: string;
  email: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  userIp: string;
}

export async function paytrInitLogic(input: PaytrInitInput) {
  const { merchantId, merchantKey, merchantSalt, testMode, configured } = getPaytrCredentials();

  if (!configured) {
    throw new Error('Ödeme sistemi henüz yapılandırılmadı. Lütfen daha sonra tekrar deneyin.');
  }
  if (!input.amount || input.amount <= 0) {
    throw new Error('Geçersiz tutar.');
  }

  const supabase = createServiceClient();
  const merchantOid = generateMerchantOid('EL');
  const paymentAmount = Math.round(input.amount * 100); // kuruş

  const { error: insertErr } = await supabase.from('payment_transactions').insert({
    merchant_oid: merchantOid,
    organization_id: input.organizationId,
    user_id: input.userId,
    purpose: input.purpose,
    purpose_payload: input.purposePayload,
    amount: input.amount,
    status: 'pending',
  });
  if (insertErr) throw insertErr;

  const userBasketBase64 = Buffer.from(JSON.stringify([[input.itemLabel, input.amount.toFixed(2), 1]])).toString('base64');
  const noInstallment = '0';
  const maxInstallment = '0';
  const currency = 'TL';

  const paytrHash = buildInitHash({
    merchantId,
    userIp: input.userIp || '127.0.0.1',
    merchantOid,
    email: input.email,
    paymentAmount,
    userBasketBase64,
    noInstallment,
    maxInstallment,
    currency,
    testMode,
    merchantSalt,
    merchantKey,
  });

  const merchantOkUrl = `${process.env.APP_BASE_URL || ''}/odeme/sonuc?merchant_oid=${merchantOid}&result=ok`;
  const merchantFailUrl = `${process.env.APP_BASE_URL || ''}/odeme/sonuc?merchant_oid=${merchantOid}&result=fail`;

  const body = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: input.userIp || '127.0.0.1',
    merchant_oid: merchantOid,
    email: input.email,
    payment_amount: String(paymentAmount),
    paytr_token: paytrHash,
    user_basket: userBasketBase64,
    debug_on: '0',
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: input.userName || input.email,
    user_address: input.userAddress || '-',
    user_phone: input.userPhone || '-',
    merchant_ok_url: merchantOkUrl,
    merchant_fail_url: merchantFailUrl,
    timeout_limit: '30',
    currency,
    test_mode: testMode,
  });

  const response = await fetch(PAYTR_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const result = await response.json();

  if (result.status !== 'success') {
    await supabase.from('payment_transactions').update({ status: 'failed', paytr_response: result }).eq('merchant_oid', merchantOid);
    throw new Error(result.reason || 'PayTR ödeme başlatma isteği reddedildi.');
  }

  return { token: result.token, merchantOid };
}

// Vercel serverless function entrypoint
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const userIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1').toString().split(',')[0].trim();
    const data = await paytrInitLogic({ ...req.body, userIp });
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: true, data }));
  } catch (err: any) {
    console.error('PayTR init error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ success: false, error: err.message || 'Internal Server Error' }));
  }
}
