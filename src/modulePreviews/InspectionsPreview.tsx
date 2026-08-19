import React, { useState } from 'react';
import { MapPin, FileText, PieChart, QrCode, Eye, PlusCircle, Calendar, CheckCircle, Plus, Trash2 } from 'lucide-react';
import InlineModal from './InlineModal';

const EXAMPLE_POINTS = [
  { business: 'Örnek İşletme', point: 'Üretim Hattı', location: 'Üretim Girişi', form: 'Aylık Hijyen Kontrolü', count: 12 },
  { business: 'Örnek İşletme', point: 'Depo Alanı', location: 'Ana Depo Girişi', form: 'Haftalık İSG Kontrolü', count: 8 },
];

const EXAMPLE_ANSWERS = [
  { q: 'Çalışma alanı temiz ve düzenli mi?', type: 'EVET / HAYIR', a: 'EVET' },
  { q: 'Kişisel koruyucu ekipman kullanılıyor mu?', type: 'UYGUN / DEĞİL', a: 'UYGUN' },
  { q: 'Acil çıkış yolları açık mı?', type: 'Derecelendirme (1-5)', a: '⭐⭐⭐⭐ (4/5)' },
  { q: 'Ek gözlemleriniz var mı?', type: 'Serbest Metin', a: 'Zemin işaretlemeleri yenilenmeli.' },
];

const QUESTION_TYPE_LABELS: Record<string, string> = {
  yes_no: 'EVET / HAYIR',
  compliant: 'UYGUN / DEĞİL',
  text: 'Serbest Metin',
  rating: 'Derecelendirme (1-5)',
};

// Örnek gönderim yoğunluğu (gün -> adet) — gerçek InspectionAnalytics.tsx'teki
// takvim mantığının aynısı, sadece Supabase yerine sabit örnek veriyle.
const EXAMPLE_DAY_COUNTS: Record<number, number> = { 3: 2, 4: 1, 9: 3, 10: 1, 17: 2, 18: 4, 24: 1 };
const MONTH_NAMES = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const RECENT_SUBMISSIONS = [
  { name: 'Ahmet Yılmaz', point: 'Üretim Hattı', date: '18 Ağu', time: '09:24' },
  { name: 'Zeynep Kara', point: 'Depo Alanı', date: '17 Ağu', time: '14:10' },
  { name: 'Mehmet Demir', point: 'Üretim Hattı', date: '17 Ağu', time: '08:55' },
  { name: 'Ahmet Yılmaz', point: 'Depo Alanı', date: '10 Ağu', time: '11:32' },
];

export default function InspectionsPreview() {
  const [subTab, setSubTab] = useState<'points' | 'forms' | 'analytics'>('points');
  const [expandedPoint, setExpandedPoint] = useState<number | null>(0);
  const [showFormExample, setShowFormExample] = useState(true);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState([
    { text: 'Çalışma alanı temiz ve düzenli mi?', type: 'yes_no' },
    { text: 'Kişisel koruyucu ekipman kullanılıyor mu?', type: 'compliant' },
  ]);
  const [formSaved, setFormSaved] = useState(false);

  const [showCreatePoint, setShowCreatePoint] = useState(false);
  const [pointName, setPointName] = useState('Yeni Üretim Hattı');
  const [pointSaved, setPointSaved] = useState(false);

  const [calMonth, setCalMonth] = useState(7); // Ağustos (0-indexed)
  const [calYear] = useState(2026);
  const firstDayIndex = (new Date(calYear, calMonth, 1).getDay() + 6) % 7;
  const totalDays = new Date(calYear, calMonth + 1, 0).getDate();
  const gridItems: (number | null)[] = [...Array.from({ length: firstDayIndex }, () => null), ...Array.from({ length: totalDays }, (_, i) => i + 1)];

  const addDraftQuestion = () => setDraftQuestions((prev) => [...prev, { text: '', type: 'yes_no' }]);
  const removeDraftQuestion = (i: number) => setDraftQuestions((prev) => prev.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setShowCreateForm(true); setFormSaved(false); }}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <PlusCircle size={14} /> Yeni Form Tasarla
        </button>
        <button
          onClick={() => { setShowCreatePoint(true); setPointSaved(false); }}
          className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold shadow-sm transition"
        >
          <PlusCircle size={14} /> Yeni Nokta &amp; QR Tanımla
        </button>
      </div>

      <div className="flex gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-gray-200 dark:border-slate-700 w-fit">
        {[
          { id: 'points', label: 'Denetim Noktaları & QR Kodlar', icon: <MapPin size={13} /> },
          { id: 'forms', label: 'Form Şablonları', icon: <FileText size={13} /> },
          { id: 'analytics', label: 'Analiz & Raporlama', icon: <PieChart size={13} /> },
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

      {subTab === 'points' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-400 uppercase text-[10px] font-bold border-b border-gray-100 dark:border-slate-700">
                <th className="p-3">İşletme</th>
                <th className="p-3">Nokta Adı</th>
                <th className="p-3">Lokasyon</th>
                <th className="p-3">Form</th>
                <th className="p-3">QR Kod</th>
                <th className="p-3">Denetimler</th>
              </tr>
            </thead>
            <tbody>
              {EXAMPLE_POINTS.map((p, i) => (
                <React.Fragment key={i}>
                  <tr className="border-b border-gray-50 dark:border-slate-700/60 last:border-0">
                    <td className="p-3 font-bold text-gray-700 dark:text-gray-200">{p.business}</td>
                    <td className="p-3 text-gray-600 dark:text-gray-300">{p.point}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{p.location}</td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{p.form}</td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-400 font-bold">
                        <QrCode size={13} /> Görüntüle
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() => setExpandedPoint(expandedPoint === i ? null : i)}
                        className="flex items-center gap-1 text-teal-600 hover:text-teal-800 font-bold"
                      >
                        <Eye size={13} /> {p.count} · Yanıtları Gör
                      </button>
                    </td>
                  </tr>
                  {expandedPoint === i && (
                    <tr className="bg-teal-50/50 dark:bg-teal-950/10">
                      <td colSpan={6} className="p-4">
                        <div className="text-[10px] font-black uppercase text-teal-700 dark:text-teal-400 mb-2">
                          Örnek Denetim Gönderimi — Ahmet Y. · 12.08.2026
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {EXAMPLE_ANSWERS.map((a, j) => (
                            <div key={j} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-2.5">
                              <div className="text-[10px] text-gray-400 font-bold mb-0.5">{a.type}</div>
                              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{a.q}</div>
                              <div className="text-xs text-teal-700 dark:text-teal-400 font-black mt-1">{a.a}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === 'forms' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 p-4 space-y-3">
          <button
            onClick={() => setShowFormExample(!showFormExample)}
            className="w-full flex items-center justify-between p-3 rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/50 dark:bg-teal-950/10 text-left"
          >
            <div>
              <div className="font-bold text-sm text-gray-800 dark:text-white">Aylık Hijyen Kontrol Formu</div>
              <div className="text-[11px] text-gray-500">Örnek İşletme · Üretim tesisi periyodik hijyen denetimi</div>
            </div>
            <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Aktif</span>
          </button>
          {showFormExample && (
            <div className="p-3 rounded-xl bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700">
              <div className="text-[10px] font-black uppercase text-gray-400 mb-2">1 Örnek Soru</div>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-teal-600" />
                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">"Çalışma alanı temiz ve düzenli mi?"</span>
                <span className="text-[9px] font-black uppercase bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full ml-auto">EVET / HAYIR</span>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'analytics' && (
        <div className="space-y-4 bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Saha Denetim Analiz &amp; Raporlama</h3>
              <p className="text-[11px] text-slate-500">Form bazlı doldurulma istatistiklerini ve takvim raporlarını inceleyin</p>
            </div>
            <select disabled className="p-2 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
              <option>Aylık Hijyen Kontrol Formu</option>
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { label: 'BU AY TOPLAM', value: 12, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/20', icon: <PieChart size={18} /> },
              { label: 'BU YIL TOPLAM', value: 87, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/20', icon: <PieChart size={18} /> },
              { label: 'GENEL TOPLAM GÖNDERİM', value: 214, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/20', icon: <Calendar size={18} /> },
            ].map((s, i) => (
              <div key={i} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">{s.label}</div>
                  <div className={`text-xl font-black mt-0.5 ${s.color}`}>{s.value} Adet</div>
                </div>
                <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>{s.icon}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <button onClick={() => setCalMonth((m) => (m === 0 ? 11 : m - 1))} className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">← Önceki</button>
                <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase">{MONTH_NAMES[calMonth]} {calYear}</h4>
                <button onClick={() => setCalMonth((m) => (m === 11 ? 0 : m + 1))} className="px-2.5 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300">Sonraki →</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((d) => (
                  <div key={d} className="text-[9px] font-bold text-slate-400 uppercase py-1">{d}</div>
                ))}
                {gridItems.map((dayNum, idx) => {
                  if (dayNum === null) return <div key={`b-${idx}`} className="aspect-square" />;
                  const count = calMonth === 7 ? (EXAMPLE_DAY_COUNTS[dayNum] || 0) : 0;
                  const style = count > 0
                    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/50'
                    : 'bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300';
                  return (
                    <div key={`d-${dayNum}`} title={count > 0 ? `${count} adet form dolduruldu` : 'Gönderim yok'} className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[10px] relative ${style}`}>
                      <span>{dayNum}</span>
                      {count > 0 && <span className="w-1 h-1 rounded-full absolute bottom-1 bg-emerald-500" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col max-h-[280px]">
              <h4 className="text-[10px] font-black text-slate-400 uppercase mb-2">Son Doldurulan Formlar</h4>
              <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                {RECENT_SUBMISSIONS.map((s, i) => (
                  <div key={i} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-700 p-2.5 rounded-xl flex justify-between items-center text-xs">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{s.name}</div>
                      <div className="text-[10px] text-slate-400">{s.point}</div>
                    </div>
                    <div className="text-right text-slate-500 font-medium">
                      {s.date}
                      <div className="text-[9px] text-slate-400">{s.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <InlineModal title="Yeni Denetim Formu Tasarla (Önizleme)" onClose={() => setShowCreateForm(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Form Başlığı</label>
            <input defaultValue="Haftalık Depo Güvenliği Kontrolü" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Açıklama</label>
            <input defaultValue="Depo alanı haftalık güvenlik ve düzen kontrolü" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Form Soruları</label>
              <button onClick={addDraftQuestion} className="flex items-center gap-1 text-[11px] font-bold text-teal-600"><Plus size={13} /> Soru Ekle</button>
            </div>
            <div className="space-y-2">
              {draftQuestions.map((q, i) => (
                <div key={i} className="flex items-center gap-2 bg-gray-50 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-700 rounded-xl p-2">
                  <input
                    value={q.text}
                    onChange={(e) => setDraftQuestions((prev) => prev.map((qq, idx) => idx === i ? { ...qq, text: e.target.value } : qq))}
                    placeholder="Soru metni..."
                    className="flex-1 bg-transparent text-xs font-semibold outline-none"
                  />
                  <select
                    value={q.type}
                    onChange={(e) => setDraftQuestions((prev) => prev.map((qq, idx) => idx === i ? { ...qq, type: e.target.value } : qq))}
                    className="text-[10px] font-bold border border-gray-200 dark:border-slate-700 dark:bg-slate-900 rounded-lg p-1"
                  >
                    {Object.entries(QUESTION_TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <button onClick={() => removeDraftQuestion(i)} className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
          </div>
          {formSaved ? (
            <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded-xl p-3 text-xs font-bold text-emerald-700 dark:text-emerald-400">
              <CheckCircle size={15} /> Örnek form oluşturuldu! Gerçek modülde bu form anında noktalarınıza atanabilir hale gelir.
            </div>
          ) : (
            <button onClick={() => setFormSaved(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Formu Kaydet
            </button>
          )}
        </InlineModal>
      )}

      {showCreatePoint && (
        <InlineModal title="Yeni Denetim Noktası & QR Tanımla (Önizleme)" onClose={() => setShowCreatePoint(false)}>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Nokta Adı</label>
            <input value={pointName} onChange={(e) => setPointName(e.target.value)} className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Lokasyon Açıklaması</label>
            <input defaultValue="Üretim Girişi" className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Bağlanacak Form</label>
            <select disabled className="w-full p-2.5 rounded-xl border border-gray-200 dark:border-slate-700 dark:bg-slate-900 text-xs font-bold">
              <option>Aylık Hijyen Kontrol Formu</option>
            </select>
          </div>
          {!pointSaved ? (
            <button onClick={() => setPointSaved(true)} className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 rounded-xl text-xs transition">
              Oluştur ve QR Kodu Üret
            </button>
          ) : (
            <div className="text-center space-y-2 bg-gray-50 dark:bg-slate-900/40 rounded-xl p-4 border border-gray-100 dark:border-slate-700">
              <div className="w-28 h-28 mx-auto bg-white border-2 border-dashed border-teal-300 rounded-xl flex items-center justify-center text-teal-500">
                <QrCode size={56} />
              </div>
              <div className="text-xs font-bold text-gray-700 dark:text-gray-200">{pointName}</div>
              <p className="text-[10px] text-gray-500">Bu QR kodu yazdırıp sahaya asabilir, denetçiler telefonla okutup formu doldurabilir.</p>
            </div>
          )}
        </InlineModal>
      )}
    </div>
  );
}
