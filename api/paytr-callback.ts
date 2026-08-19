// api/paytr-callback.ts
// PayTR'ın ödeme sonucu için sunucu-sunucu (kullanıcı oturumu olmadan) POST
// ettiği bildirim (webhook) uç noktası. PayTR'ın gereksinimi: gövde
// application/x-www-form-urlencoded'dır, JSON DEĞİLDİR; ve başarıyla
// işlendiğinde yanıt olarak düz metin "OK" dönülmelidir — dönülmezse PayTR
// bildirimi periyodik olarak tekrar göndermeye devam eder.
import { getPaytrCredentials, createServiceClient, buildCallbackHash, activatePurchase } from './paytrShared';

export async function paytrCallbackLogic(formBody: URLSearchParams): Promise<string> {
  const { merchantKey, merchantSalt, configured } = getPaytrCredentials();
  if (!configured) {
    // Kimlik bilgileri yoksa bu bildirim zaten bize ait olamaz.
    return 'PAYTR notification rejected: not configured';
  }

  const merchantOid = formBody.get('merchant_oid') || '';
  const status = formBody.get('status') || '';
  const totalAmount = formBody.get('total_amount') || '';
  const hash = formBody.get('hash') || '';

  const expectedHash = buildCallbackHash({ merchantOid, merchantSalt, status, totalAmount, merchantKey });
  if (expectedHash !== hash) {
    console.error('PayTR callback hash mismatch', { merchantOid });
    return 'PAYTR notification failed: bad hash';
  }

  const supabase = createServiceClient();
  const { data: tx, error: fetchErr } = await supabase
    .from('payment_transactions')
    .select('*')
    .eq('merchant_oid', merchantOid)
    .maybeSingle();

  if (fetchErr || !tx) {
    console.error('PayTR callback: transaction not found', merchantOid, fetchErr);
    return 'PAYTR notification failed: unknown merchant_oid';
  }

  // İdempotentlik: PayTR aynı bildirimi birden fazla kez gönderebilir; zaten
  // işlenmiş bir sipariş tekrar aktivasyona sokulmaz.
  if (tx.status !== 'pending') {
    return 'OK';
  }

  const rawResponse = Object.fromEntries(formBody.entries());

  if (status === 'success') {
    try {
      await activatePurchase(tx as any);
      await supabase
        .from('payment_transactions')
        .update({ status: 'success', paytr_response: rawResponse, updated_at: new Date().toISOString() })
        .eq('merchant_oid', merchantOid);
      return 'OK';
    } catch (err: any) {
      console.error('PayTR callback: activation failed', merchantOid, err);
      // Aktivasyon başarısız oldu — durumu 'pending' bırakıyoruz ki PayTR
      // bildirimi tekrar gönderdiğinde yeniden denenebilsin.
      return 'PAYTR notification failed: activation error';
    }
  }

  await supabase
    .from('payment_transactions')
    .update({ status: 'failed', paytr_response: rawResponse, updated_at: new Date().toISOString() })
    .eq('merchant_oid', merchantOid);
  return 'OK';
}

// Vercel serverless function entrypoint
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.end('Method Not Allowed');
    return;
  }

  try {
    // Vercel, x-www-form-urlencoded gövdeyi otomatik olarak req.body'de
    // (bir obje olarak) parse eder; PayTR'ın alan adlarını URLSearchParams
    // arayüzüne uydurmak için yeniden sarmalıyoruz.
    const params = new URLSearchParams();
    const bodyObj = typeof req.body === 'string' ? Object.fromEntries(new URLSearchParams(req.body)) : req.body || {};
    Object.entries(bodyObj).forEach(([k, v]) => params.set(k, String(v)));

    const result = await paytrCallbackLogic(params);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end(result);
  } catch (err: any) {
    console.error('PayTR callback handler error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('PAYTR notification failed: server error');
  }
}
