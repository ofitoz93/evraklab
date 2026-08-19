import React, { useState } from 'react';
import { PenLine, Plus, FileText, CheckCircle } from 'lucide-react';
import InlineModal from './InlineModal';

const STATUS_STYLES: Record<string, string> = {
  approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
};
const STATUS_LABELS: Record<string, string> = {
  approved: 'Onaylandı',
  rejected: 'Reddedildi',
  pending: 'Onay Bekliyor',
};

const INITIAL_LETTERS = [
  { no: '2026-03', subject: 'Atık Su Deşarj İzni Hakkında Görüş', institution: 'Örnek İl Çevre Müdürlüğü', client: 'Örnek İşletme A.Ş.', date: '04.08.2026', status: 'approved' },
  { no: '2026-02', subject: 'ÇED Muafiyet Başvurusu Değerlendirmesi', institution: 'Örnek Valiliği', client: 'Örnek Lojistik Ltd.', date: '21.07.2026', status: 'pending' },
  { no: '2025-11', subject: 'Gürültü Ölçüm Raporu İtiraz Değerlendirmesi', institution: 'Örnek Belediyesi', client: 'Örnek İşletme A.Ş.', date: '02.12.2025', status: 'rejected' },
];

export default function OpinionsPreview() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const [showCreate, setShowCreate] = useState(false);
  const [saved, setSaved] = useState(false);
  const [letters, setLetters] = useState(INITIAL_LETTERS);
  const [clientFilter, setClientFilter] = useState('all');
  const [draftSubject, setDraftSubject] = useState('Atık Su Deşarj İzni Hakkında Görüş');
  const [draftBody, setDraftBody] = useState(
    'Tesisinizde oluşan atık suların, ilgili yönetmelik kapsamında belirlenen deşarj standartlarına uygunluğu incelenmiş olup, aşağıdaki hususlarda görüşümüz sunulmuştur...'
  );

  const clients = ['all', ...Array.from(new Set(letters.map((l) => l.client)))];
  const filtered = letters.filter((l) => clientFilter === 'all' || l.client === clientFilter);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => { setShowCreate(true); setSaved(false); }}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <Plus size={14} /> Yeni Görüş Hazırla
        </button>
        <select
          value={clientFilter}
          onChange={(e) => setClientFilter(e.target.value)}
          className="p-2 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-[11px] font-bold text-gray-600 dark:text-gray-300"
        >
          {clients.map((c) => <option key={c} value={c}>{c === 'all' ? 'Tüm İşletmeler' : c}</option>)}
        </select>
      </div>

      <div className="space-y-2.5">
        {filtered.map((l, i) => (
          <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-3 p-4 text-left"
            >
              <div className="flex items-center gap-3">
                <div className="bg-blue-50 dark:bg-blue-950/20 text-blue-600 p-2 rounded-xl">
                  <PenLine size={16} />
                </div>
                <div>
                  <div className="text-[10px] font-mono font-black text-blue-600">{l.no}</div>
                  <div className="font-bold text-sm text-gray-800 dark:text-white">{l.subject}</div>
                  <div className="text-[11px] text-gray-500">{l.client} · {l.institution} · {l.date}</div>
                </div>
              </div>
              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[l.status]}`}>
                {STATUS_LABELS[l.status]}
              </span>
            </button>
            {openIndex === i && (
              <div className="px-4 pb-4">
                <div className="bg-gray-50 dark:bg-slate-900/40 rounded-xl border border-gray-100 dark:border-slate-700 p-3 text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed flex items-start gap-2">
                  <FileText size={14} className="text-blue-500 shrink-0 mt-0.5" />
                  <span>
                    "...tesisimizde oluşan atık suların, ilgili yönetmelik kapsamında belirlenen deşarj standartlarına
                    uygunluğu incelenmiş olup, aşağıdaki hususlarda görüşümüz sunulmuştur..." — resmi kurum yazışması formatında,
                    otomatik sıra numaralı ({l.no}), imzaya hazır taslak.
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showCreate && (
        <InlineModal title="Yeni Görüş Hazırla (Önizleme)" color="bg-blue-600" onClose={() => setShowCreate(false)}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">İşletme</label>
              <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
                <option>Örnek İşletme A.Ş.</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Muhatap Kurum</label>
              <input defaultValue="Örnek İl Çevre Müdürlüğü" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Konu</label>
            <input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Görüş Metni</label>
              <span className="text-[9px] font-mono font-black text-blue-600 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded">Sıra No: 2026-04 (otomatik)</span>
            </div>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              rows={5}
              className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs leading-relaxed"
            />
          </div>
          {saved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek görüş taslağı oluşturuldu! Gerçek modülde resmi yazı formatında PDF'e dönüştürülüp imzaya hazır hale gelir.
            </div>
          ) : (
            <button
              onClick={() => {
                setLetters((prev) => [{ no: '2026-04', subject: draftSubject, institution: 'Örnek İl Çevre Müdürlüğü', client: 'Örnek İşletme A.Ş.', date: '19.08.2026', status: 'pending' }, ...prev]);
                setSaved(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs transition"
            >
              Taslağı Kaydet
            </button>
          )}
        </InlineModal>
      )}
    </div>
  );
}
