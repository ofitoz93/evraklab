import React, { useState } from 'react';
import { UserCheck, Info } from 'lucide-react';

interface Props {
  memberName: string;
  loading?: boolean;
  onConfirm: (rehireDate: string) => void;
  onCancel: () => void;
}

// "Ayrılan Personeller" sekmesindeki "Geri Al" butonu tarafından kullanılır.
// Personel gerçekten bir süre ayrıldıktan sonra tekrar işe alınıyor olabilir
// — bu yüzden yeni işe başlangıç tarihi seçilebilir olmalı (varsayılan
// bugün). Girilen tarih, eski çıkış tarihinden sonraysa yeni bir çalışma
// dönemi olarak kaydedilir ve aradaki boşluk aylarına maaş gideri
// üretilmez; eski çıkış tarihiyle aynı/öncesindeyse "yanlışlıkla çıkarma"
// düzeltmesi olarak eski dönem aynen devam eder.
export default function RehireDateModal({ memberName, loading, onConfirm, onCancel }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [rehireDate, setRehireDate] = useState(today);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 dark:border-slate-700 animate-scaleIn">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 shrink-0">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">Tekrar İşe Al</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-bold">{memberName}</span> adlı personel tekrar ekibe eklenecek.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Yeni İşe Başlangıç Tarihi</label>
            <input
              type="date"
              value={rehireDate}
              onChange={(e) => setRehireDate(e.target.value)}
              className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <p className="text-[10px] text-slate-400 mt-1 flex items-start gap-1">
              <Info size={12} className="shrink-0 mt-0.5" />
              Ayrıldığı tarihten sonraki gerçek başlangıç tarihini girin — bu ay kıst (gün oranlı) hesaplanır,
              ayrılışıyla yeni başlangıcı arasındaki aylara maaş gideri üretilmez.
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 rounded-lg text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-700 transition disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              onClick={() => onConfirm(rehireDate)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              <UserCheck size={14} /> {loading ? 'İşleniyor...' : 'Geri Al'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
