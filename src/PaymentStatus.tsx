import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Loader, CheckCircle, XCircle, Clock } from 'lucide-react';

// PayTR'ın gerçek sonucu (başarılı/başarısız aktivasyon) sunucu-sunucu
// /api/paytr-callback bildirimiyle gelir — bu bildirim, kullanıcının
// tarayıcısındaki yönlendirmeden BİRKAÇ SANİYE sonra ulaşabilir. Bu yüzden
// burada tek seferlik bir kontrol yerine, payment_transactions.status
// 'pending' olmaktan çıkana kadar (success/failed) birkaç saniyede bir
// yoklama (polling) yapılır.
export default function PaymentStatus() {
  const [searchParams] = useSearchParams();
  const merchantOid = searchParams.get('merchant_oid') || '';
  const urlResult = searchParams.get('result');
  const [status, setStatus] = useState<'pending' | 'success' | 'failed'>('pending');
  const [waitedTooLong, setWaitedTooLong] = useState(false);

  useEffect(() => {
    if (!merchantOid) return;
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      attempts += 1;
      const { data } = await supabase
        .from('payment_transactions')
        .select('status')
        .eq('merchant_oid', merchantOid)
        .maybeSingle();

      if (cancelled) return;
      if (data?.status === 'success' || data?.status === 'failed') {
        setStatus(data.status);
        return;
      }
      if (attempts >= 30) {
        setWaitedTooLong(true);
        return;
      }
      setTimeout(poll, 2000);
    };

    poll();
    return () => {
      cancelled = true;
    };
  }, [merchantOid]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 dark:bg-slate-950">
      <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-xl p-8 max-w-sm w-full text-center space-y-4">
        {status === 'pending' && !waitedTooLong && (
          <>
            <Loader className="mx-auto animate-spin text-purple-600" size={36} />
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Ödemeniz Kontrol Ediliyor</h2>
            <p className="text-xs text-gray-500">PayTR'dan sonucu bekliyoruz, bu birkaç saniye sürebilir. Lütfen sayfayı kapatmayın.</p>
          </>
        )}
        {status === 'pending' && waitedTooLong && (
          <>
            <Clock className="mx-auto text-amber-500" size={36} />
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Sonuç Bekleniyor</h2>
            <p className="text-xs text-gray-500">
              {urlResult === 'fail'
                ? 'Ödemeniz tamamlanmamış görünüyor.'
                : 'Ödeme onayı beklenenden uzun sürüyor. Kısa süre içinde otomatik olarak aktif edilecektir; sorun devam ederse destek ile iletişime geçin.'}
            </p>
          </>
        )}
        {status === 'success' && (
          <>
            <CheckCircle className="mx-auto text-emerald-500" size={40} />
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Ödemeniz Alındı!</h2>
            <p className="text-xs text-gray-500">Satın alımınız aktif edildi.</p>
          </>
        )}
        {status === 'failed' && (
          <>
            <XCircle className="mx-auto text-red-500" size={40} />
            <h2 className="font-bold text-lg text-gray-800 dark:text-white">Ödeme Başarısız</h2>
            <p className="text-xs text-gray-500">Kartınızdan tutar çekilmedi. Lütfen tekrar deneyin.</p>
          </>
        )}
        <Link
          to="/"
          className="inline-block mt-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition"
        >
          Panele Dön
        </Link>
      </div>
    </div>
  );
}
