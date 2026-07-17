import { useState } from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';

interface Props {
  clientName: string;
  loading?: boolean;
  onConfirm: (terminationDate: string) => void;
  onCancel: () => void;
}

// ExitDateModal.tsx'in (personel çıkışı) müşteri hizmet sonlandırmasına
// uyarlanmış hali - aynı yapı, müşteriye özel metin. Firma hizmetten daha
// önce (ör. geçen ay) fiilen çekilmiş olabilir, bu yüzden tarih geriye
// tarihlenebilir (varsayılan bugün).
export default function TerminateServiceModal({ clientName, loading, onConfirm, onCancel }: Props) {
  const today = new Date().toISOString().split('T')[0];
  const [terminationDate, setTerminationDate] = useState(today);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-100 dark:border-slate-700 animate-scaleIn">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-red-50 text-red-600 dark:bg-red-950/20 shrink-0">
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 dark:text-white">Hizmet Sonlandır</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-bold">{clientName}</span> ile hizmet ilişkisi sonlandırılacak.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Sonlandırma Tarihi</label>
            <input
              type="date"
              value={terminationDate}
              max={today}
              onChange={(e) => setTerminationDate(e.target.value)}
              className="w-full p-2 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Bu tarihten sonrası için ödeme/alacak kaydı oluşturulmayacaktır. Firma daha önce fiilen bırakılmışsa gerçek tarihi seçin.
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
              onClick={() => onConfirm(terminationDate)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
            >
              <XCircle size={14} /> {loading ? 'Sonlandırılıyor...' : 'Sonlandır'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
