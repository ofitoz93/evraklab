import React from 'react';
import { X, ShoppingBag, Sparkles } from 'lucide-react';

interface ModulePreviewModalProps {
  moduleName: string;
  price: number;
  onClose: () => void;
  onPurchase: () => void;
  children: React.ReactNode;
}

export default function ModulePreviewModal({ moduleName, price, onClose, onPurchase, children }: ModulePreviewModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-6 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-6xl w-full h-full sm:h-[92vh] overflow-hidden shadow-2xl border border-gray-100 dark:border-slate-700 flex flex-col animate-scaleUp">
        <div className="bg-gradient-to-r from-purple-900 via-indigo-800 to-purple-800 p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 border border-white/20 p-2.5 rounded-2xl">
              <Sparkles className="text-purple-200" size={20} />
            </div>
            <div>
              <span className="bg-purple-500/30 border border-purple-400/40 text-purple-200 text-[9px] font-black tracking-widest uppercase px-2.5 py-0.5 rounded-full inline-block mb-1">
                Önizleme — Örnek Veriler
              </span>
              <h3 className="text-white font-extrabold text-lg leading-tight">{moduleName}</h3>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition">
            <X size={22} />
          </button>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900 px-5 py-2 text-[11px] text-amber-800 dark:text-amber-300 font-bold text-center shrink-0">
          Bu bir önizlemedir — aşağıdaki tüm veriler örnektir, hiçbir kaydınız değişmez veya oluşturulmaz.
        </div>

        <div className="overflow-y-auto p-5 md:p-6 space-y-5 bg-gray-50/60 dark:bg-slate-900/40 flex-1">
          {children}
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
            Bu modülü ekibiniz için hemen aktif etmek ister misiniz?
          </span>
          <button
            onClick={onPurchase}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95 whitespace-nowrap"
          >
            <ShoppingBag size={15} /> Modülü Şimdi Satın Al (₺{price}/Ay)
          </button>
        </div>
      </div>
    </div>
  );
}
