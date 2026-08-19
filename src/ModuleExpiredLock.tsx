import React from 'react';
import { Lock, ShoppingBag } from 'lucide-react';

interface ModuleExpiredLockProps {
  moduleName: string;
  onPurchase: () => void;
}

export default function ModuleExpiredLock({ moduleName, onPurchase }: ModuleExpiredLockProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-10 flex flex-col items-center text-center animate-fadeIn max-w-md mx-auto">
      <div className="bg-amber-50 dark:bg-amber-950/20 text-amber-600 p-4 rounded-2xl mb-4">
        <Lock size={28} />
      </div>
      <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">Modül Süresi Doldu</h3>
      <p className="text-xs text-slate-500 mt-1.5 mb-5">
        <strong>{moduleName}</strong> modülünüzün süresi doldu. Bu modülü kullanmaya devam etmek için lütfen tekrar satın alın.
      </p>
      <button
        onClick={onPurchase}
        className="flex items-center gap-2 bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold px-4 py-2.5 rounded-xl text-xs shadow-md transition active:scale-95"
      >
        <ShoppingBag size={15} /> Modülü Satın Al
      </button>
    </div>
  );
}
