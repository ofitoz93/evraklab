import React, { useState } from 'react';
import { CheckCircle, Clock, Plus, Paperclip, MessageSquare } from 'lucide-react';
import InlineModal from './InlineModal';

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-blue-50 text-blue-700 border-blue-200',
  correction_requested: 'bg-red-50 text-red-700 border-red-200',
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};
const STATUS_LABELS: Record<string, string> = {
  pending: 'Aksiyon Bekliyor (Açık)',
  completed: 'Onay Bekliyor',
  correction_requested: 'Düzeltme İstendi',
  approved: 'Onaylandı',
};

const INITIAL_ACTIONS = [
  { client: 'Örnek İşletme A.Ş.', title: 'Yangın Söndürme Tüplerinin Yıllık Bakımının Yaptırılması', status: 'pending', due: '20.08.2026', assignee: 'Ahmet Yılmaz', overdue: false, evidence: false, comment: '' },
  { client: 'Örnek Lojistik Ltd.', title: 'Atık Yağ Toplama Sözleşmesinin Yenilenmesi', status: 'completed', due: '05.08.2026', assignee: 'Zeynep Demir', overdue: true, evidence: true, comment: '' },
  { client: 'Örnek İşletme A.Ş.', title: 'İSG Kurulu Toplantı Tutanağının İmzalatılması', status: 'correction_requested', due: '12.08.2026', assignee: 'Ahmet Yılmaz', overdue: false, evidence: true, comment: 'Yüklenen belgede kurul üyelerinin imzası eksik, lütfen tamamlayıp tekrar yükleyin.' },
];

export default function ActionsPreview() {
  const [subTab, setSubTab] = useState<'pending' | 'completed'>('pending');
  const [actions, setActions] = useState(INITIAL_ACTIONS);
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [openDetail, setOpenDetail] = useState<number | null>(null);

  const completeAction = (i: number) => setActions((prev) => prev.map((a, idx) => idx === i ? { ...a, status: 'completed' } : a));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700">
          <button onClick={() => setSubTab('pending')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${subTab === 'pending' ? 'bg-amber-500 text-white' : 'text-gray-500'}`}>
            <Clock size={13} /> Bekleyen Aksiyonlar
          </button>
          <button onClick={() => setSubTab('completed')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${subTab === 'completed' ? 'bg-emerald-600 text-white' : 'text-gray-500'}`}>
            <CheckCircle size={13} /> Tamamlanan Aksiyonlar
          </button>
        </div>
        <button
          onClick={() => { setShowCreate(true); setSaved(false); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
        >
          <Plus size={14} /> Yeni Aksiyon Oluştur
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {actions.map((a, i) => (subTab === 'pending' ? a.status === 'pending' : a.status !== 'pending') && (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-2">
            <div className="text-[10px] font-bold text-gray-400 uppercase">{a.client}</div>
            <div className="font-bold text-sm text-gray-800 dark:text-white">{a.title}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>
                {STATUS_LABELS[a.status]}
              </span>
              {a.evidence && (
                <span className="flex items-center gap-1 text-[9px] font-black uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">
                  <Paperclip size={9} /> Kanıt Belgesi Var
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-gray-400">Sorumlu: {a.assignee}</span>
              <span className={`font-bold ${a.overdue ? 'text-red-600' : 'text-gray-500'}`}>Son Tarih: {a.due}</span>
            </div>
            {a.status === 'pending' ? (
              <button onClick={() => completeAction(i)} className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition">
                Aksiyonu Tamamla
              </button>
            ) : (
              <button onClick={() => setOpenDetail(openDetail === i ? null : i)} className="w-full py-2 rounded-xl border border-gray-200 dark:border-slate-700 text-xs font-bold text-gray-600 dark:text-gray-300 transition hover:bg-gray-50 dark:hover:bg-slate-700">
                {openDetail === i ? 'Gizle' : 'Detay'}
              </button>
            )}
            {openDetail === i && (
              <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-[11px] text-gray-600 dark:text-gray-300 space-y-1.5">
                {a.comment ? (
                  <div className="flex items-start gap-2">
                    <MessageSquare size={12} className="text-red-500 shrink-0 mt-0.5" />
                    <span><strong>Yönetici notu:</strong> {a.comment}</span>
                  </div>
                ) : (
                  <span>Bu aksiyon için yüklenen kanıt belgesi ve personel açıklaması burada görüntülenir; yönetici tek tıkla onaylayabilir veya düzeltme talep edebilir.</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <InlineModal title="Yeni Aksiyon Oluştur (Önizleme)" color="bg-blue-600" onClose={() => setShowCreate(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Müşteri Firma</label>
              <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
                <option>Örnek İşletme A.Ş.</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Sorumlu Personel</label>
              <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
                <option>Ahmet Yılmaz</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Aksiyon Başlığı</label>
            <input defaultValue="Acil Durum Tatbikatının Planlanması" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Son Tarih</label>
            <input type="date" defaultValue="2026-09-01" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          {saved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek aksiyon oluşturuldu! Sorumlu personele anında bildirim gider.
            </div>
          ) : (
            <button onClick={() => setSaved(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Aksiyonu Oluştur
            </button>
          )}
        </InlineModal>
      )}
    </div>
  );
}
