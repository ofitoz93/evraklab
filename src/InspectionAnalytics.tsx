import React, { useState, useEffect } from 'react';
import { PieChart, Calendar, Loader } from 'lucide-react';

interface Submission {
  id: string;
  submitted_at: string;
  submitted_by_name: string;
  submitted_by_surname: string;
  point: {
    id: string;
    name: string;
    form_id: string;
  };
}

interface InspectionAnalyticsProps {
  inspectionForms: any[];
  supabase: any;
}

export default function InspectionAnalytics({ inspectionForms, supabase }: InspectionAnalyticsProps) {
  const [selectedFormId, setSelectedFormId] = useState('');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  // stats
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [monthSubmissions, setMonthSubmissions] = useState(0);
  const [yearSubmissions, setYearSubmissions] = useState(0);

  // Grouped by day
  const [dayCounts, setDayCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (inspectionForms.length > 0 && !selectedFormId) {
      setSelectedFormId(inspectionForms[0].id);
    }
  }, [inspectionForms]);

  useEffect(() => {
    if (selectedFormId) {
      fetchSubmissions();
    }
  }, [selectedFormId]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      // Query submissions for selected form
      const { data, error } = await supabase
        .from('inspection_submissions')
        .select('id, submitted_at, submitted_by_name, submitted_by_surname, point:inspection_points!inner(id, name, form_id)')
        .eq('point.form_id', selectedFormId);

      if (error) throw error;

      const list = (data || []) as unknown as Submission[];
      setSubmissions(list);

      // Calculate totals
      setTotalSubmissions(list.length);

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      let thisMonthCount = 0;
      let thisYearCount = 0;
      const counts: Record<string, number> = {};

      list.forEach((sub) => {
        const dateObj = new Date(sub.submitted_at);
        const subYear = dateObj.getFullYear();
        const subMonth = dateObj.getMonth();

        // Standard YYYY-MM-DD
        const yyyy = dateObj.getFullYear();
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd}`;

        counts[dateStr] = (counts[dateStr] || 0) + 1;

        if (subYear === currentYear) {
          thisYearCount++;
          if (subMonth === currentMonth) {
            thisMonthCount++;
          }
        }
      });

      setMonthSubmissions(thisMonthCount);
      setYearSubmissions(thisYearCount);
      setDayCounts(counts);

    } catch (err: any) {
      console.error('Error fetching submissions for analytics:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed

  // First day of month index (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Adjust so Monday is 0: (firstDayIndex + 6) % 7
  const adjustedFirstDayIndex = (firstDayIndex + 6) % 7;

  // Number of days in month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Array of day numbers
  const daysArray = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Blank slots before the first day
  const blanks = Array.from({ length: adjustedFirstDayIndex }, () => null);

  const gridItems = [...blanks, ...daysArray];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const monthNames = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  return (
    <div className="space-y-6 bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Saha Denetim Analiz & Raporlama</h3>
          <p className="text-xs text-slate-500">Form bazlı doldurulma istatistiklerini ve takvim raporlarını inceleyin</p>
        </div>
        <div className="w-full md:w-64">
          <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Form Seçin</label>
          <select
            className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none text-xs font-bold text-slate-700 dark:text-slate-300 border-slate-200"
            value={selectedFormId}
            onChange={(e) => setSelectedFormId(e.target.value)}
          >
            {inspectionForms.length === 0 ? (
              <option value="">-- Henüz Form Yok --</option>
            ) : (
              inspectionForms.map((f) => (
                <option key={f.id} value={f.id}>{f.title}</option>
              ))
            )}
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">BU AY TOPLAM</span>
            <h4 className="text-2xl font-black text-teal-600 dark:text-teal-400 mt-1">{loading ? '...' : monthSubmissions} Adet</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <PieChart size={20} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">BU YIL TOPLAM</span>
            <h4 className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">{loading ? '...' : yearSubmissions} Adet</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <PieChart size={20} />
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">GENEL TOPLAM GÖNDERİM</span>
            <h4 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-1">{loading ? '...' : totalSubmissions} Adet</h4>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
            <Calendar size={20} />
          </div>
        </div>
      </div>

      {/* Main Grid: Calendar and Submissions Table */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Calendar Card */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handlePrevMonth}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition"
            >
              &larr; Önceki
            </button>
            <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-wide">
              {monthNames[month]} {year}
            </h4>
            <button
              onClick={handleNextMonth}
              className="px-3 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-300 transition"
            >
              Sonraki &rarr;
            </button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {/* Week Headers */}
            {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map((day) => (
              <div key={day} className="text-[10px] font-bold text-slate-400 uppercase py-1">
                {day}
              </div>
            ))}

            {/* Days */}
            {gridItems.map((dayNum, index) => {
              if (dayNum === null) {
                return <div key={`blank-${index}`} className="aspect-square" />;
              }

              const isToday = new Date().toDateString() === new Date(year, month, dayNum).toDateString();
              
              // Count for this day
              const formattedDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              const count = dayCounts[formattedDateStr] || 0;

              let bgStyle = 'bg-slate-50 dark:bg-slate-900/30 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750';
              if (count > 0) {
                if (isToday) {
                  // Today has submissions: bright success green!
                  bgStyle = 'bg-emerald-500 text-white font-extrabold shadow-lg shadow-emerald-500/20';
                } else {
                  // Other days with submissions: nice sage green
                  bgStyle = 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-900/50';
                }
              } else if (isToday) {
                // Today has no submissions
                bgStyle = 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-800';
              }

              return (
                <div
                  key={`day-${dayNum}`}
                  title={count > 0 ? `${count} adet form dolduruldu` : 'Gönderim yok'}
                  className={`aspect-square flex flex-col items-center justify-center rounded-xl text-xs cursor-pointer transition select-none relative group ${bgStyle}`}
                >
                  <span>{dayNum}</span>
                  {count > 0 && (
                    <span className={`w-1.5 h-1.5 rounded-full absolute bottom-1 ${isToday ? 'bg-white' : 'bg-emerald-500'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Submissions List inside Analytics */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col h-[320px] overflow-hidden">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3">Son Doldurulan Formlar</h4>
          <div className="overflow-y-auto flex-1 space-y-2.5 pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin text-teal-600" size={20} />
              </div>
            ) : submissions.length === 0 ? (
              <div className="text-center text-xs text-slate-400 italic py-12">
                Henüz doldurulmuş form bulunamadı.
              </div>
            ) : (
              submissions.map((sub) => (
                <div key={sub.id} className="bg-slate-50 dark:bg-slate-900/30 border border-slate-100 dark:border-slate-750 p-3 rounded-xl flex justify-between items-center text-xs gap-3">
                  <div>
                    <div className="font-bold text-slate-800 dark:text-slate-200">
                      {sub.submitted_by_name} {sub.submitted_by_surname}
                    </div>
                    <div className="text-[10px] text-slate-450 mt-0.5">{sub.point?.name}</div>
                  </div>
                  <div className="text-slate-500 font-medium whitespace-nowrap text-right">
                    {new Date(sub.submitted_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                    <div className="text-[9px] text-slate-400 mt-0.5">
                      {new Date(sub.submitted_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
