import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

// PayTR ödeme sonucunda kullanıcıyı bu sayfaya (merchant_ok_url /
// merchant_fail_url) yönlendirir — ama bu yönlendirme PaytrCheckoutModal
// içindeki <iframe>'in İÇİNDE gerçekleşir. Bu sayfanın tek görevi, aynı
// origin'den (window.top ile aynı domain) faydalanarak kullanıcıyı hemen
// iframe'in dışına, gerçek durumu sorgulayan /odeme/durum sayfasına çıkarmak.
export default function PaymentReturn() {
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const merchantOid = searchParams.get('merchant_oid') || '';
    const result = searchParams.get('result') || 'ok';
    const target = `/odeme/durum?merchant_oid=${encodeURIComponent(merchantOid)}&result=${encodeURIComponent(result)}`;
    if (window.top) {
      window.top.location.href = target;
    } else {
      window.location.href = target;
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
      Yönlendiriliyor...
    </div>
  );
}
