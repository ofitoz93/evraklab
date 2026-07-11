import { Play } from 'lucide-react';
import type { TourId } from './types';
import { HELP_TOURS } from './tours';

interface VideoGuideGridProps {
  tourIds: TourId[];
  roleLabel?: string;
  onOpenTour: (id: TourId, roleLabel?: string) => void;
}

export default function VideoGuideGrid({ tourIds, roleLabel, onOpenTour }: VideoGuideGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tourIds.map((id) => {
        const meta = HELP_TOURS[id];
        const Icon = meta.icon;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onOpenTour(id, roleLabel)}
            className="text-left bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-slate-700 shadow-lg p-6 flex flex-col justify-between hover:border-blue-300 dark:hover:border-blue-700 transition"
          >
            <div>
              <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-2xl flex items-center justify-center mb-4">
                <Icon size={22} />
              </div>
              <h4 className="text-base font-bold text-gray-800 dark:text-white mb-1.5">{meta.title}</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {meta.description}
              </p>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-slate-700 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400">
              <Play size={16} /> İzle
            </div>
          </button>
        );
      })}
    </div>
  );
}
