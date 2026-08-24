import React, { useState } from 'react';
import { FlaskConical, Upload, Download, Sparkles, CheckCircle } from 'lucide-react';
import InlineModal from './InlineModal';

const STATUS_STYLES: Record<string, string> = {
  expired: 'bg-red-50 text-red-700 border-red-200',
  approaching: 'bg-amber-50 text-amber-700 border-amber-200',
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  unknown: 'bg-gray-100 text-gray-500 border-gray-200',
};
const STATUS_LABELS: Record<string, string> = {
  expired: 'Süresi Geçmiş',
  approaching: 'Yaklaşan',
  valid: 'Geçerli',
  unknown: 'Belirsiz',
};

const EXAMPLE_DOCS = [
  { product: 'Endüstriyel Yağ Çözücü', expiry: '15.09.2026', status: 'approaching' },
  { product: 'Klorlu Yüzey Dezenfektanı', expiry: '02.03.2027', status: 'valid' },
  { product: 'Asit Bazlı Temizleyici', expiry: '10.06.2026', status: 'expired' },
];

export default function MsdsPreview() {
  const [showUpload, setShowUpload] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState(false);

  const startParsing = () => {
    setParsing(true);
    setParsed(false);
    setTimeout(() => { setParsing(false); setParsed(true); }, 1600);
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['expired', 'approaching', 'valid', 'unknown'] as const).map((s) => (
          <div key={s} className={`rounded-xl border p-3 ${STATUS_STYLES[s]}`}>
            <div className="text-2xl font-black">{s === 'valid' ? 5 : s === 'approaching' ? 2 : s === 'expired' ? 1 : 0}</div>
            <div className="text-[10px] font-bold uppercase">{STATUS_LABELS[s]}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setShowUpload(true); setParsed(false); }}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Upload size={14} /> Yeni Toplu MSDS Yükle
        </button>
        <button className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 px-3.5 py-2 rounded-xl text-xs font-bold">
          <Download size={14} /> Excel'e Aktar
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
              <th className="p-3">Ürün Adı</th>
              <th className="p-3">Son Geçerlilik Tarihi</th>
              <th className="p-3">Durum</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_DOCS.map((d, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                <td className="p-3 font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <FlaskConical size={13} className="text-teal-600" /> {d.product}
                </td>
                <td className="p-3 text-gray-500 dark:text-gray-400">{d.expiry}</td>
                <td className="p-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[d.status]}`}>
                    {STATUS_LABELS[d.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {showUpload && (
        <InlineModal title="Toplu MSDS Yükle (Önizleme)" onClose={() => setShowUpload(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">İşletme</label>
            <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
              <option>Örnek İşletme A.Ş.</option>
            </select>
          </div>
          <div className="border-2 border-dashed border-teal-300 dark:border-teal-800 rounded-2xl p-6 text-center">
            <Upload className="mx-auto text-teal-500 mb-2" size={26} />
            <div className="text-xs font-bold text-gray-600 dark:text-gray-300">"Endustriyel_Yag_Cozucu_MSDS.pdf" seçildi</div>
            <button onClick={startParsing} disabled={parsing} className="mt-3 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition disabled:opacity-60">
              {parsing ? 'Ayrıştırılıyor...' : 'PDF\'i Yükle ve Ayrıştır'}
            </button>
          </div>
          {parsing && (
            <div className="flex items-center gap-2 bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-900 rounded-xl p-3 text-xs font-bold text-teal-700 dark:text-teal-400 animate-pulse">
              <Sparkles size={15} /> PDF ayrıştırılıyor — ürün adı, birincil tarih ve son geçerlilik tarihi otomatik okunuyor...
            </div>
          )}
          {parsed && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <CheckCircle size={15} /> Otomatik okundu, kontrol edip kaydedebilirsiniz:
              </div>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 border border-gray-100 dark:border-slate-700 text-xs">
                <div><span className="text-[10px] text-gray-400 block">Ürün Adı</span><span className="font-bold">Endüstriyel Yağ Çözücü</span></div>
                <div><span className="text-[10px] text-gray-400 block">Son Geçerlilik</span><span className="font-bold">15.09.2026</span></div>
              </div>
            </div>
          )}
        </InlineModal>
      )}
    </div>
  );
}
