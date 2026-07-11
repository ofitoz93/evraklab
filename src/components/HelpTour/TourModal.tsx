import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TourDefinition, TourId } from './types';
import { HELP_TOURS } from './tours';
import TourEngine from './TourEngine';

interface TourModalProps {
  tourId: TourId;
  roleLabel?: string;
  onClose: () => void;
}

export default function TourModal({ tourId, roleLabel, onClose }: TourModalProps) {
  const [tour, setTour] = useState<TourDefinition | null>(null);
  const meta = HELP_TOURS[tourId];

  useEffect(() => {
    let cancelled = false;
    setTour(null);
    meta.load().then((mod) => {
      if (!cancelled) setTour(mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [tourId, meta]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const Icon = meta.icon;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-tour-title"
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col border border-gray-100 dark:border-slate-700"
      >
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-slate-700 flex-none">
          <h3
            id="help-tour-title"
            className="font-bold text-lg flex items-center gap-2 text-gray-900 dark:text-white"
          >
            <Icon className="text-blue-600 dark:text-blue-400" size={20} />
            {meta.title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Kapat"
            className="text-gray-400 hover:text-red-500"
          >
            <X size={22} />
          </button>
        </div>

        {tour ? (
          <TourEngine steps={tour.steps}>
            <tour.StageComponent roleLabel={roleLabel} />
          </TourEngine>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mb-4" />
            <p className="text-sm font-medium">Rehber yükleniyor...</p>
          </div>
        )}
      </div>
    </div>
  );
}
