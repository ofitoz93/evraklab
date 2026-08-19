import React, { useState } from 'react';
import { Scale, BookOpen, Check, Plus, Building, CheckCircle, Calendar, AlertCircle } from 'lucide-react';
import InlineModal from './InlineModal';

const INITIAL_REGULATIONS = [
  { category: 'Yönetmelik', title: 'Atıksu Altyapı ve Evsel Katı Atık Bertaraf Tesisleri Tarifelerinin Belirlenmesinde Uyulacak Usul ve Esaslara İlişkin Yönetmelik', rgNo: '27673', rgDate: '27.10.2010', inPool: true },
  { category: 'Tebliğ', title: 'Çevresel Gürültünün Değerlendirilmesi ve Yönetimi Tebliği', rgNo: '29457', rgDate: '04.06.2015', inPool: false },
  { category: 'Kanun', title: 'Çevre Kanunu', rgNo: '18132', rgDate: '11.08.1983', inPool: true },
];

const TRACKING = [
  { title: 'Çevre Kanunu', client: 'Örnek İşletme A.Ş.', status: 'compliant' },
  { title: 'Atıksu Altyapı Yönetmeliği', client: 'Örnek İşletme A.Ş.', status: 'compliant' },
  { title: 'ÇED Yönetmeliği', client: 'Örnek Lojistik Ltd.', status: 'action_needed' },
];

const STATUS_STYLES: Record<string, string> = {
  compliant: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  action_needed: 'bg-amber-50 text-amber-700 border-amber-200',
};
const STATUS_LABELS: Record<string, string> = { compliant: 'Uyumlu', action_needed: 'Aksiyon Gerekli' };

export default function LegislationsPreview() {
  const [subTab, setSubTab] = useState<'pool' | 'assignments' | 'tracking' | 'calendar'>('pool');
  const [regulations, setRegulations] = useState(INITIAL_REGULATIONS);
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState(false);

  const addToPool = (i: number) => setRegulations((prev) => prev.map((r, idx) => idx === i ? { ...r, inPool: true } : r));

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 w-fit flex-wrap">
        {[
          { id: 'pool', label: 'Mevzuat Havuzu', icon: <BookOpen size={13} /> },
          { id: 'assignments', label: 'İşletme Atamaları', icon: <Building size={13} /> },
          { id: 'tracking', label: 'Mevzuat Takip', icon: <Scale size={13} /> },
          { id: 'calendar', label: 'Ziyaret Takvimi', icon: <Calendar size={13} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              subTab === t.id ? 'bg-teal-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'pool' && (
        <div className="space-y-2.5">
          <button
            onClick={() => { setShowCreate(true); setSaved(false); }}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus size={14} /> Yeni Mevzuat Ekle
          </button>
          {regulations.map((r, i) => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 flex items-start justify-between gap-3">
              <div>
                <span className="text-[9px] font-black uppercase bg-teal-50 text-teal-700 px-2 py-0.5 rounded-full">{r.category}</span>
                <div className="font-bold text-sm text-gray-800 dark:text-white mt-1.5">{r.title}</div>
                <div className="text-[11px] text-gray-500 mt-0.5">RG No: {r.rgNo} · RG Tarihi: {r.rgDate}</div>
              </div>
              {r.inPool ? (
                <span className="flex items-center gap-1 text-[10px] font-black uppercase bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full shrink-0">
                  <Check size={12} /> Havuzumuzda
                </span>
              ) : (
                <button onClick={() => addToPool(i)} className="text-[10px] font-black uppercase bg-teal-600 hover:bg-teal-700 text-white px-2.5 py-1.5 rounded-full shrink-0 transition">
                  Firmamıza Ekle
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {subTab === 'assignments' && (
        <div className="space-y-2.5">
          {['Örnek İşletme A.Ş.', 'Örnek Lojistik Ltd.'].map((client, ci) => (
            <div key={ci} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building size={15} className="text-teal-600" />
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-200">{client}</span>
                </div>
                <span className="text-[10px] font-bold text-gray-500">{ci === 0 ? 2 : 1} mevzuat atanmış</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                {regulations.filter((r) => r.inPool).slice(0, ci === 0 ? 2 : 1).map((r, ri) => (
                  <span key={ri} className="text-[10px] font-bold bg-teal-50 dark:bg-teal-950/20 text-teal-700 dark:text-teal-400 px-2 py-1 rounded-lg">
                    {r.title.length > 32 ? r.title.slice(0, 32) + '…' : r.title}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3">
            <Scale size={14} className="text-teal-600" />
            Her işletmeye, faaliyet konusuna uygun mevzuatları tek tık ile atayıp uyum takibini otomatik başlatabilirsiniz.
          </div>
        </div>
      )}

      {subTab === 'tracking' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                <th className="p-3">Mevzuat</th>
                <th className="p-3">İşletme</th>
                <th className="p-3">Uyum Durumu</th>
              </tr>
            </thead>
            <tbody>
              {TRACKING.map((t, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                  <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{t.title}</td>
                  <td className="p-3 text-gray-500">{t.client}</td>
                  <td className="p-3">
                    <span className={`flex items-center gap-1 w-fit text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[t.status]}`}>
                      {t.status === 'action_needed' && <AlertCircle size={10} />} {STATUS_LABELS[t.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'calendar' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
            <Calendar size={16} className="text-teal-600" /> Yaklaşan Saha Ziyaretleri
          </div>
          {[
            { client: 'Örnek İşletme A.Ş.', date: '25.08.2026', purpose: 'Periyodik Mevzuat Uyum Kontrolü' },
            { client: 'Örnek Lojistik Ltd.', date: '02.09.2026', purpose: 'ÇED Süreç Değerlendirmesi' },
          ].map((v, i) => (
            <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
              <div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{v.client}</div>
                <div className="text-[10px] text-gray-500">{v.purpose}</div>
              </div>
              <span className="text-xs font-black text-teal-700 dark:text-teal-400">{v.date}</span>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <InlineModal title="Yeni Mevzuat Ekle (Önizleme)" onClose={() => setShowCreate(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Kategori</label>
            <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
              <option>Yönetmelik</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Mevzuat Adı</label>
            <input defaultValue="Sanayi Kaynaklı Hava Kirliliğinin Kontrolü Yönetmeliği" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">RG No</label>
              <input defaultValue="25699" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">RG Tarihi</label>
              <input type="date" defaultValue="2004-07-03" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
            </div>
          </div>
          {saved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek mevzuat sistem havuzuna eklendi! İşletmelerinize tek tıkla atayabilirsiniz.
            </div>
          ) : (
            <button onClick={() => setSaved(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Havuza Ekle
            </button>
          )}
        </InlineModal>
      )}
    </div>
  );
}
