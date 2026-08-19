import React from 'react';
import { X } from 'lucide-react';

interface InlineModalProps {
  title: string;
  color?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function InlineModal({ title, color = 'bg-teal-600', onClose, children }: InlineModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-100 dark:border-slate-700 animate-scaleUp">
        <div className={`p-5 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between ${color} text-white rounded-t-3xl sticky top-0`}>
          <h3 className="font-bold text-sm pr-4">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition shrink-0"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}
