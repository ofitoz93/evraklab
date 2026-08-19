import React, { useState } from 'react';
import { Crown, User, Network } from 'lucide-react';

const INITIAL_GROUPS = [
  { chief: 'Ayşe Yılmaz', staff: ['Mehmet Kaya', 'Zeynep Demir'] },
  { chief: 'Can Öztürk', staff: ['Elif Şahin'] },
];
const UNASSIGNED_INITIAL = ['Barış Kurt'];

export default function OrgChartPreview() {
  const [groups, setGroups] = useState(INITIAL_GROUPS);
  const [unassigned, setUnassigned] = useState(UNASSIGNED_INITIAL);

  const reassign = (name: string, targetChiefIndex: number | 'unassigned') => {
    setGroups((prev) => prev.map((g) => ({ ...g, staff: g.staff.filter((s) => s !== name) })));
    setUnassigned((prev) => prev.filter((s) => s !== name));
    if (targetChiefIndex === 'unassigned') {
      setUnassigned((prev) => [...prev, name]);
    } else {
      setGroups((prev) => prev.map((g, i) => i === targetChiefIndex ? { ...g, staff: [...g.staff, name] } : g));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm font-bold text-gray-700 dark:text-gray-200">
        <Network size={16} className="text-indigo-600" /> Organizasyon Şeması
      </div>

      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 px-4 py-2.5 rounded-2xl">
          <Crown size={16} className="text-rose-600" />
          <div>
            <div className="text-xs font-black text-rose-800 dark:text-rose-300">Ozhan F.</div>
            <div className="text-[10px] text-rose-500 font-bold uppercase">Firma Sahibi</div>
          </div>
        </div>

        <div className="w-px h-5 bg-gray-300 dark:bg-slate-600" />

        <div className="grid sm:grid-cols-2 gap-4 w-full">
          {groups.map((g, gi) => (
            <div key={gi} className="bg-purple-50/60 dark:bg-purple-950/10 border border-purple-200 dark:border-purple-900 rounded-2xl p-3 space-y-2">
              <div className="flex items-center gap-2 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 border border-purple-200 dark:border-purple-900">
                <User size={14} className="text-purple-600" />
                <div>
                  <div className="text-xs font-black text-purple-900 dark:text-purple-300">{g.chief}</div>
                  <div className="text-[9px] text-purple-500 font-bold uppercase">Firma Yöneticisi (Şef)</div>
                </div>
              </div>
              <div className="pl-4 space-y-1.5">
                {g.staff.length === 0 && <div className="text-[10px] text-gray-400 italic">Bu şefe bağlı personel yok</div>}
                {g.staff.map((s, j) => (
                  <div key={j} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                    <span className="w-3 h-px bg-gray-300 dark:bg-slate-600" /> {s}
                    <select
                      value={gi}
                      onChange={(e) => reassign(s, e.target.value === 'unassigned' ? 'unassigned' : Number(e.target.value))}
                      className="ml-auto text-[9px] font-bold border border-gray-200 dark:border-slate-700 dark:bg-slate-900 rounded-lg px-1 py-0.5"
                    >
                      {groups.map((gg, ggi) => <option key={ggi} value={ggi}>{gg.chief}</option>)}
                      <option value="unassigned">Doğrudan Firma Sahibi</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {unassigned.length > 0 && (
          <div className="w-full bg-gray-50 dark:bg-slate-900/40 border border-gray-200 dark:border-slate-700 rounded-2xl p-3">
            <div className="text-[10px] font-black uppercase text-gray-400 mb-1.5">Doğrudan Firma Sahibine Bağlı Personel</div>
            {unassigned.map((s, j) => (
              <div key={j} className="flex items-center gap-2 text-xs font-bold text-gray-600 dark:text-gray-300">
                <User size={12} /> {s}
                <select
                  onChange={(e) => reassign(s, Number(e.target.value))}
                  defaultValue=""
                  className="ml-auto text-[9px] font-bold border border-gray-200 dark:border-slate-700 dark:bg-slate-900 rounded-lg px-1 py-0.5"
                >
                  <option value="" disabled>Bir şefe ata...</option>
                  {groups.map((gg, ggi) => <option key={ggi} value={ggi}>{gg.chief}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-500 text-center">
        Yukarıdaki açılır menülerden bir personeli deneme amaçlı başka bir şefe (veya doğrudan firma sahibine) atayabilirsiniz — şema anında güncellenir.
      </p>
    </div>
  );
}
