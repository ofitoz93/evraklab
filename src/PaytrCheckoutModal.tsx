import React, { useState } from 'react';
import { X, CreditCard, Loader, AlertCircle } from 'lucide-react';
import { apiUrl } from './apiBase';

export type PaytrPurpose =
  | 'module_purchase'
  | 'subscription_individual'
  | 'subscription_corporate_new'
  | 'subscription_corporate_renewal'
  | 'storage';

interface PaytrCheckoutModalProps {
  purpose: PaytrPurpose;
  purposePayload: any;
  amount: number;
  itemLabel: string;
  organizationId: string | null;
  userId: string;
  userEmail: string;
  userFullName?: string;
  userPhone?: string;
  onClose: () => void;
}

// Ekstra Modül / Üyelik / Depolama satın alma akışlarının üçü de bu paylaşılan
// bileşeni kullanır. PayTR iFrame API'sinin zorunlu tuttuğu ama profiles
// tablosunda karşılığı olmayan "fatura adresi" bilgisini burada tek seferlik
// sorar, /api/paytr-init'ten dönen token ile PayTR'ın güvenli ödeme sayfasını
// iframe içinde açar. Ödeme sonucu, PayTR'ın sunucu-sunucu bildirdiği
// /api/paytr-callback tarafından işlenir — bu modal sadece kullanıcıyı
// PayTR'a yönlendirmekle sorumludur, aktivasyonu kendisi yapmaz.
export default function PaytrCheckoutModal({
  purpose,
  purposePayload,
  amount,
  itemLabel,
  organizationId,
  userId,
  userEmail,
  userFullName,
  userPhone,
  onClose,
}: PaytrCheckoutModalProps) {
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(userPhone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [iframeToken, setIframeToken] = useState<string | null>(null);

  const startCheckout = async () => {
    if (!address.trim()) {
      setError('Lütfen fatura adresinizi girin.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/paytr-init'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          userId,
          purpose,
          purposePayload,
          amount,
          itemLabel,
          email: userEmail,
          userName: userFullName || userEmail,
          userAddress: address.trim(),
          userPhone: phone.trim(),
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Ödeme başlatılamadı.');
      setIframeToken(json.data.token);
    } catch (err: any) {
      setError(err.message || 'Ödeme başlatılamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[80] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full max-h-[92vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col animate-scaleUp">
        <div className="p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-purple-900 to-indigo-800 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <CreditCard size={20} />
            <div>
              <h3 className="font-bold text-sm">Güvenli Ödeme (PayTR)</h3>
              <p className="text-[11px] text-purple-200">{itemLabel} — ₺{amount.toLocaleString('tr-TR')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!iframeToken ? (
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Fatura Adresi</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  placeholder="Mahalle, cadde/sokak, no, ilçe/il"
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Telefon</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                />
              </div>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 text-xs text-red-700 dark:text-red-400 font-medium">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
                </div>
              )}
              <button
                onClick={startCheckout}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold py-3 rounded-xl text-sm transition disabled:opacity-50"
              >
                {loading ? <Loader size={16} className="animate-spin" /> : <CreditCard size={16} />}
                {loading ? 'Yönlendiriliyor...' : 'Ödemeye Geç'}
              </button>
            </div>
          ) : (
            <iframe
              src={`https://www.paytr.com/odeme/guvenli/${iframeToken}`}
              id="paytriframe"
              title="PayTR Güvenli Ödeme"
              frameBorder={0}
              scrolling="no"
              style={{ width: '100%', minHeight: 620, border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
