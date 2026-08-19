import React, { useState } from 'react';
import { Inbox, Download, XCircle, CheckCircle } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse',
  fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const STATUS_LABELS: Record<string, string> = { pending: 'Bekliyor', fulfilled: 'Karşılandı' };

const INITIAL_REQUESTS = [
  { title: 'Güncel Mali Sorumluluk Sigortası Poliçesi', client: 'Örnek İşletme A.Ş.', desc: '2026 yılına ait güncellenmiş poliçe belgesi talep edilmiştir.', status: 'pending' },
  { title: 'İSG Kurulu Toplantı Tutanağı (Temmuz)', client: 'Örnek Lojistik Ltd.', desc: 'Temmuz ayı İSG kurulu toplantı tutanağının paylaşılması.', status: 'fulfilled' },
];

export default function DocumentRequestsPreview() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'fulfilled'>('all');
  const [requests, setRequests] = useState(INITIAL_REQUESTS);
  const [title, setTitle] = useState('');
  const [sent, setSent] = useState(false);

  const sendRequest = () => {
    if (!title.trim()) return;
    setRequests((prev) => [{ title: title.trim(), client: 'Örnek İşletme A.Ş.', desc: 'Yeni oluşturulan örnek talep.', status: 'pending' }, ...prev]);
    setTitle('');
    setSent(true);
    setTimeout(() => setSent(false), 2500);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
          <Inbox size={16} className="text-blue-600" /> Yeni Evrak Talebi Oluştur
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <input disabled placeholder="İşletme: Örnek İşletme A.Ş." className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/40 text-xs" />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Talep Başlığı: Örn. Güncel Mali Sigorta"
            className="p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold"
          />
        </div>
        <button onClick={sendRequest} className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition">
          Talebi Gönder
        </button>
        {sent && (
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            <CheckCircle size={14} /> Örnek talep oluşturuldu ve listeye eklendi!
          </div>
        )}
      </div>

      <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 w-fit">
        {(['all', 'pending', 'fulfilled'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${filter === f ? 'bg-blue-600 text-white' : 'text-gray-500'}`}
          >
            {f === 'all' ? 'Tümü' : f === 'pending' ? 'Bekliyor' : 'Karşılandı'}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        {requests.filter((r) => filter === 'all' || r.status === filter).map((r, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 flex items-start justify-between gap-3">
            <div>
              <div className="font-bold text-sm text-gray-800 dark:text-white">{r.title}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">{r.client} · {r.desc}</div>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.status]}`}>
                {STATUS_LABELS[r.status]}
              </span>
              {r.status === 'fulfilled' ? (
                <span className="flex items-center gap-1 text-[10px] font-bold text-blue-600"><Download size={11} /> İndir</span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-bold text-gray-400"><XCircle size={11} /> İptal</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
