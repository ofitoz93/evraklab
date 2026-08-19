import React, { useState } from 'react';
import { Bell, Eye, FileText, Check, X } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};
const STATUS_LABELS: Record<string, string> = { pending: 'Bekliyor', approved: 'Onaylandı', rejected: 'Reddedildi' };

const INITIAL_REQUESTS = [
  { title: 'Yeni Ambalaj Atığı Yönetmeliği Kapsamına Alınması Talebi', status: 'pending', type: 'Firma İçi Talep', requester: 'Ayşe Yılmaz', client: 'Örnek İşletme A.Ş.', hasDraft: true },
  { title: 'ÇED Yönetmeliği Ek-2 Listesi Güncelleme Talebi', status: 'approved', type: 'Admin Talebi', requester: 'Mehmet Kaya', client: 'Örnek Lojistik Ltd.', hasDraft: false },
];

export default function RequestsPreview() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [requests, setRequests] = useState(INITIAL_REQUESTS);

  const setStatus = (i: number, status: 'approved' | 'rejected') =>
    setRequests((prev) => prev.map((r, idx) => idx === i ? { ...r, status } : r));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
        <Bell size={16} className="text-teal-600" /> Gönderilen Mevzuat Talepleri
      </div>
      {requests.map((r, i) => (
        <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 flex items-start justify-between gap-3">
            <div>
              <span className="text-[9px] font-black uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{r.type}</span>
              <div className="font-bold text-sm text-gray-800 dark:text-white mt-1.5">{r.title}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{r.requester} · {r.client}</div>
              {r.hasDraft && (
                <span className="inline-block mt-1.5 text-[9px] font-black uppercase bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">
                  📄 Tam Mevzuat Metni Ekli (12 madde)
                </span>
              )}
            </div>
            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[r.status]}`}>
              {STATUS_LABELS[r.status]}
            </span>
          </div>
          <div className="px-4 pb-4">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="flex items-center gap-1.5 text-[11px] font-bold text-teal-600 hover:text-teal-800"
            >
              <Eye size={12} /> İncele (ve Cevapla)
            </button>
            {openIndex === i && (
              <div className="mt-2 space-y-2">
                <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-[11px] text-gray-600 dark:text-gray-300 flex items-start gap-2">
                  <FileText size={13} className="text-teal-600 shrink-0 mt-0.5" />
                  Talebi onaylarsanız mevzuat, sistem havuzuna eklenir ve ilgili işletmenin takip listesine otomatik yansır; reddederseniz talep sahibine gerekçeli bir not iletebilirsiniz.
                </div>
                {r.status === 'pending' && (
                  <div className="flex gap-2">
                    <button onClick={() => setStatus(i, 'approved')} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition">
                      <Check size={12} /> Onayla
                    </button>
                    <button onClick={() => setStatus(i, 'rejected')} className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900 text-red-600 text-[11px] font-bold px-3 py-1.5 rounded-lg transition">
                      <X size={12} /> Reddet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
