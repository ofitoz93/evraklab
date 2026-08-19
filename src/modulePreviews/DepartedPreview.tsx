import React, { useState } from 'react';
import { LogOut, User, RefreshCw, CheckCircle } from 'lucide-react';

const EXAMPLE_DEPARTED = [
  { name: 'Barış Kurt', position: 'Saha Denetim Uzmanı', hire: '01.03.2023', exit: '15.06.2026', months: 39 },
  { name: 'Selin Aydın', position: 'Çevre Mühendisi', hire: '10.09.2024', exit: '30.07.2026', months: 22 },
];

export default function DepartedPreview() {
  const [reactivated, setReactivated] = useState<Record<number, boolean>>({});

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
        <LogOut size={16} className="text-rose-600" /> Ayrılan Personeller
      </div>
      {EXAMPLE_DEPARTED.map((d, i) => (
        <div key={i} className={`bg-white dark:bg-slate-800 rounded-2xl border p-4 flex items-center justify-between gap-3 transition ${reactivated[i] ? 'border-emerald-300 dark:border-emerald-800' : 'border-gray-200 dark:border-slate-700'}`}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-gray-400">
              <User size={16} />
            </div>
            <div>
              <div className="font-bold text-sm text-gray-800 dark:text-white">{d.name}</div>
              <div className="text-[11px] text-gray-500">{d.position} · {d.months} ay çalıştı</div>
              <div className="text-[10px] text-gray-400">İşe Giriş: {d.hire} · <span className="text-rose-600 font-bold">Ayrılış: {d.exit}</span></div>
            </div>
          </div>
          {reactivated[i] ? (
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600">
              <CheckCircle size={13} /> Ekibe Geri Alındı
            </span>
          ) : (
            <button
              onClick={() => setReactivated((prev) => ({ ...prev, [i]: true }))}
              className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 border border-emerald-200 dark:border-emerald-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 px-3 py-1.5 rounded-xl transition"
            >
              <RefreshCw size={12} /> Geri Al
            </button>
          )}
        </div>
      ))}
      <p className="text-[11px] text-gray-500 text-center pt-1">
        Ayrılan personel kaydı, aktif ekip listesinden çıkar ama geçmiş görüş/rapor kayıtlarında görünmeye devam eder; "Geri Al" ile tekrar aktif edilebilir.
      </p>
    </div>
  );
}
