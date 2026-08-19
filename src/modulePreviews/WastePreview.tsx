import React, { useState } from 'react';
import { Plus, Download, MapPin, Tag, Building2, CheckCircle, Recycle, Flame } from 'lucide-react';
import InlineModal from './InlineModal';

const EXAMPLE_RECORDS = [
  { code: '15 01 01', desc: 'Kağıt ve karton ambalaj', qty: 240, type: 'recovery', transporter: 'Örnek Geri Dönüşüm A.Ş.', date: '03.08.2026' },
  { code: '20 01 21*', desc: 'Floresan lambalar', qty: 12, type: 'disposal', transporter: 'Örnek Çevre Bertaraf Ltd.', date: '28.07.2026' },
  { code: '17 04 05', desc: 'Demir ve çelik hurdası', qty: 890, type: 'recovery', transporter: 'Örnek Geri Dönüşüm A.Ş.', date: '15.07.2026' },
];

export default function WastePreview() {
  const [showDeclaration, setShowDeclaration] = useState(false);
  const [declarationPeriod, setDeclarationPeriod] = useState<'monthly' | 'yearly' | 'all'>('monthly');
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showAddFirm, setShowAddFirm] = useState(false);
  const [firmSaved, setFirmSaved] = useState(false);

  const recoveryTotal = EXAMPLE_RECORDS.filter((r) => r.type === 'recovery').reduce((s, r) => s + r.qty, 0);
  const disposalTotal = EXAMPLE_RECORDS.filter((r) => r.type === 'disposal').reduce((s, r) => s + r.qty, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 flex items-center gap-2">
          <Recycle size={20} className="text-emerald-600" />
          <div>
            <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">{recoveryTotal} kg</div>
            <div className="text-[10px] font-bold uppercase text-emerald-600">Geri Kazanım</div>
          </div>
        </div>
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3 flex items-center gap-2">
          <Flame size={20} className="text-amber-600" />
          <div>
            <div className="text-lg font-black text-amber-700 dark:text-amber-400">{disposalTotal} kg</div>
            <div className="text-[10px] font-bold uppercase text-amber-600">Bertaraf</div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-3 flex items-center gap-2">
          <Tag size={20} className="text-gray-400" />
          <div>
            <div className="text-lg font-black text-gray-700 dark:text-gray-200">{EXAMPLE_RECORDS.length}</div>
            <div className="text-[10px] font-bold uppercase text-gray-400">Toplam Hareket</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setShowCreate(true); setSaved(false); }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus size={14} /> Yeni Atık Kaydı
        </button>
        <button
          onClick={() => { setShowAddFirm(true); setFirmSaved(false); }}
          className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-300 px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Building2 size={14} /> Taşıyıcı/Bertaraf Firması Ekle
        </button>
        <button
          onClick={() => setShowDeclaration(true)}
          className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-400 px-3.5 py-2 rounded-xl text-xs font-bold transition"
        >
          <Download size={14} /> Beyan Çıktısı Al (PDF)
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
              <th className="p-3">Atık Kodu</th>
              <th className="p-3">Açıklama</th>
              <th className="p-3">Miktar</th>
              <th className="p-3">Tür</th>
              <th className="p-3">Taşıyan Firma</th>
              <th className="p-3">Çıkış Tarihi</th>
            </tr>
          </thead>
          <tbody>
            {EXAMPLE_RECORDS.map((r, i) => (
              <tr key={i} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                <td className="p-3 font-mono font-bold text-gray-700 dark:text-gray-200 flex items-center gap-1.5">
                  <Tag size={12} className="text-emerald-600" /> {r.code}
                </td>
                <td className="p-3 text-gray-600 dark:text-gray-300">{r.desc}</td>
                <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{r.qty} kg</td>
                <td className="p-3">
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                    r.type === 'recovery' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {r.type === 'recovery' ? 'Geri Kazanım' : 'Bertaraf'}
                  </span>
                </td>
                <td className="p-3 text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                  <MapPin size={12} /> {r.transporter}
                </td>
                <td className="p-3 text-gray-500 dark:text-gray-400">{r.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showCreate && (
        <InlineModal title="Yeni Atık Kaydı Ekle (Önizleme)" color="bg-emerald-600" onClose={() => setShowCreate(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Atık Kodu</label>
            <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold font-mono">
              <option>15 01 01 — Kağıt ve karton ambalaj</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Miktar (kg)</label>
              <input defaultValue="185" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tür</label>
              <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
                <option>Geri Kazanım</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Taşıyan Firma</label>
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
              <MapPin size={13} className="text-emerald-600" /> Örnek Geri Dönüşüm A.Ş. <span className="text-[10px] text-gray-400 font-normal ml-auto">(haritadan seçildi)</span>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Çıkış Tarihi</label>
            <input type="date" defaultValue="2026-08-19" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          {saved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek atık kaydı oluşturuldu! Gerçek modülde bu kayıt anında listeye ve beyan raporuna yansır.
            </div>
          ) : (
            <button onClick={() => setSaved(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Kaydı Kaydet
            </button>
          )}
        </InlineModal>
      )}

      {showAddFirm && (
        <InlineModal title="Taşıyıcı / Bertaraf Firması Ekle (Önizleme)" color="bg-emerald-600" onClose={() => setShowAddFirm(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Firma Adı</label>
            <input defaultValue="Örnek Geri Dönüşüm A.Ş." className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tesis Konumu (Harita)</label>
            <div className="h-32 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/10 flex flex-col items-center justify-center text-emerald-600 gap-1">
              <MapPin size={26} />
              <span className="text-[10px] font-bold">Haritada işaretlenen konum: 40.9876° K, 29.1234° D</span>
            </div>
          </div>
          {firmSaved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek firma eklendi! Artık atık kaydı oluştururken bu firmayı seçebilirsiniz.
            </div>
          ) : (
            <button onClick={() => setFirmSaved(true)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Firmayı Kaydet
            </button>
          )}
        </InlineModal>
      )}

      {showDeclaration && (
        <InlineModal title="Atık Beyan Çıktısı Al (Önizleme)" color="bg-emerald-600" onClose={() => setShowDeclaration(false)}>
          <div className="flex gap-1.5 bg-gray-50 dark:bg-slate-900/40 p-1.5 rounded-xl border border-gray-100 dark:border-slate-700 w-fit">
            {(['monthly', 'yearly', 'all'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setDeclarationPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${declarationPeriod === p ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}
              >
                {p === 'monthly' ? 'Aylık' : p === 'yearly' ? 'Yıllık' : 'Tümü'}
              </button>
            ))}
          </div>
          <div className="bg-emerald-50/60 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900 rounded-2xl p-4 text-xs text-emerald-800 dark:text-emerald-300 font-medium">
            {declarationPeriod === 'monthly' && <>Seçilen dönem: <strong>Ağustos 2026</strong> — 1 hareket, toplam 240 kg</>}
            {declarationPeriod === 'yearly' && <>Seçilen dönem: <strong>2026</strong> — 3 hareket, toplam 1.142 kg</>}
            {declarationPeriod === 'all' && <>Tüm kayıtlar — 3 hareket, toplam 1.142 kg (2026 başından bugüne)</>}
          </div>
          <button className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
            <Download size={14} /> Resmi Atık Beyan Formu (PDF) İndir
          </button>
        </InlineModal>
      )}
    </div>
  );
}
