import React, { useState } from 'react';
import { PieChart, TrendingUp, ChevronDown, ChevronRight, Wallet, Receipt, Plus, CheckCircle, Users, Trash2 } from 'lucide-react';
import InlineModal from './InlineModal';

const PAYMENTS = [
  { client: 'Örnek İşletme A.Ş.', month: 'Ağustos 2026', amount: 4500, paid: true },
  { client: 'Örnek Lojistik Ltd.', month: 'Ağustos 2026', amount: 3200, paid: false },
  { client: 'Örnek Danışmanlık San. Tic.', month: 'Ağustos 2026', amount: 2800, paid: true },
];

const INITIAL_EXPENSES = [
  { title: 'Eylül Ofis Kirası', category: 'Ofis / Kira', amount: 4500, date: '01.08.2026' },
  { title: 'Saha Personeli Maaşı — A. Yılmaz', category: 'Maaş / Personel', amount: 12000, date: '01.08.2026' },
  { title: 'Muhasebe Yazılımı Lisansı', category: 'Yazılım / Lisans', amount: 850, date: '05.08.2026' },
];

export default function FinanceManagementPreview() {
  const [subTab, setSubTab] = useState<'summary' | 'payments' | 'expenses'>('summary');
  const [expanded, setExpanded] = useState(true);
  const [payments, setPayments] = useState(PAYMENTS);
  const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState(false);

  const togglePaid = (i: number) => setPayments((prev) => prev.map((p, idx) => idx === i ? { ...p, paid: !p.paid } : p));
  const removeExpense = (i: number) => setExpenses((prev) => prev.filter((_, idx) => idx !== i));

  const totalCollected = payments.filter((p) => p.paid).reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => !p.paid).reduce((s, p) => s + p.amount, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalCollected - totalExpenses;

  return (
    <div className="space-y-5">
      <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 w-fit">
        {[
          { id: 'summary', label: 'Finansal Özet', icon: <PieChart size={13} /> },
          { id: 'payments', label: 'Müşteri Ödemeleri', icon: <Wallet size={13} /> },
          { id: 'expenses', label: 'Gider Yönetimi', icon: <Receipt size={13} /> },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as any)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${
              subTab === t.id ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {subTab === 'summary' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3">
              <div className="text-lg font-black text-emerald-700 dark:text-emerald-400">₺{totalCollected.toLocaleString('tr-TR')}</div>
              <div className="text-[10px] font-bold uppercase text-emerald-600">Tahsil Edilen</div>
            </div>
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 rounded-xl p-3">
              <div className="text-lg font-black text-amber-700 dark:text-amber-400">₺{totalPending.toLocaleString('tr-TR')}</div>
              <div className="text-[10px] font-bold uppercase text-amber-600">Beklenen</div>
            </div>
            <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 rounded-xl p-3">
              <div className="text-lg font-black text-rose-700 dark:text-rose-400">₺{totalExpenses.toLocaleString('tr-TR')}</div>
              <div className="text-[10px] font-bold uppercase text-rose-600">Toplam Gider</div>
            </div>
            <div className={`rounded-xl p-3 border ${netProfit >= 0 ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900' : 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'}`}>
              <div className={`text-lg font-black flex items-center gap-1 ${netProfit >= 0 ? 'text-blue-700 dark:text-blue-400' : 'text-rose-700 dark:text-rose-400'}`}>
                <TrendingUp size={15} /> ₺{netProfit.toLocaleString('tr-TR')}
              </div>
              <div className={`text-[10px] font-bold uppercase ${netProfit >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>Net Kâr/Zarar</div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between p-4 text-left">
              <div className="flex items-center gap-2">
                {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                <PieChart size={15} className="text-indigo-600" />
                <span className="font-bold text-sm text-gray-800 dark:text-white">Ağustos 2026</span>
              </div>
              <span className={`text-xs font-bold ${netProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>Net: {netProfit >= 0 ? '+' : ''}₺{netProfit.toLocaleString('tr-TR')}</span>
            </button>
            {expanded && (
              <div className="px-4 pb-4 grid sm:grid-cols-2 gap-3">
                <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 mb-2">
                    <Wallet size={12} /> Müşteri Tahsilatları
                  </div>
                  {payments.map((p, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-200 mt-1 first:mt-0">
                      <span>{p.client}</span><span className={p.paid ? 'text-emerald-600' : 'text-amber-600'}>{p.paid ? 'Tahsil Edildi' : 'Bekliyor'}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl p-3 border border-gray-100 dark:border-slate-700">
                  <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-gray-400 mb-2">
                    <Receipt size={12} /> Gider Kırılımı
                  </div>
                  {expenses.map((e, i) => (
                    <div key={i} className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-200 mt-1 first:mt-0">
                      <span>{e.category}</span><span>₺{e.amount.toLocaleString('tr-TR')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'payments' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="p-3 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
            <Users size={14} className="text-indigo-600" /> Ağustos 2026 — İşletme Bazlı Tahsilat Durumu
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                <th className="p-3">İşletme</th>
                <th className="p-3">Aylık Ücret</th>
                <th className="p-3">Durum</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                  <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{p.client}</td>
                  <td className="p-3 text-gray-600 dark:text-gray-300">₺{p.amount.toLocaleString('tr-TR')}</td>
                  <td className="p-3">
                    <button
                      onClick={() => togglePaid(i)}
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded-full border transition ${
                        p.paid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {p.paid ? 'Tahsil Edildi' : 'Bekliyor — İşaretle'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {subTab === 'expenses' && (
        <div className="space-y-3">
          <button
            onClick={() => { setShowCreate(true); setSaved(false); }}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
          >
            <Plus size={14} /> Yeni Gider Kaydı Oluştur
          </button>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                  <th className="p-3">Gider</th>
                  <th className="p-3">Kategori</th>
                  <th className="p-3">Tutar</th>
                  <th className="p-3">Tarih</th>
                  <th className="p-3 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                    <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{e.title}</td>
                    <td className="p-3"><span className="text-[9px] font-black uppercase bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">{e.category}</span></td>
                    <td className="p-3 text-rose-600 font-bold">₺{e.amount.toLocaleString('tr-TR')}</td>
                    <td className="p-3 text-gray-500">{e.date}</td>
                    <td className="p-3 text-right">
                      <button onClick={() => removeExpense(i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      )}

      {showCreate && (
        <InlineModal title="Yeni Gider Kaydı Oluştur (Önizleme)" color="bg-indigo-600" onClose={() => setShowCreate(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Gider Başlığı</label>
            <input defaultValue="Ekim Ofis Kirası" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Kategori</label>
              <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
                <option>Ofis / Kira</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Tutar (TL)</label>
              <input defaultValue="4.500" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
            </div>
          </div>
          {saved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek gider kaydı oluşturuldu! Gerçek modülde net kâr hesaplamasına anında yansır.
            </div>
          ) : (
            <button
              onClick={() => {
                setExpenses((prev) => [{ title: 'Yeni Örnek Gider', category: 'Diğer', amount: 500, date: '19.08.2026' }, ...prev]);
                setSaved(true);
              }}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Kaydet
            </button>
          )}
        </InlineModal>
      )}
    </div>
  );
}
