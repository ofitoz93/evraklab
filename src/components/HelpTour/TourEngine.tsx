import { useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import type { TourStep } from './types';
import { useTourEngine } from './useTourEngine';
import './helpTour.css';

interface TourEngineProps {
  steps: TourStep[];
  children: ReactNode;
}

export default function TourEngine({ steps, children }: TourEngineProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const { index, step, total, targetRect, playing, next, prev, jumpTo, togglePlay } = useTourEngine(
    steps,
    stageRef
  );

  const placeBelow = !!targetRect && targetRect.top < 140;

  return (
    <div className="flex flex-col lg:flex-row gap-4 p-4 md:p-5 overflow-y-auto">
      {/* Adım rayı */}
      <nav
        aria-label="Rehber bölümleri"
        className="lg:w-64 flex-none border border-gray-200 dark:border-slate-700 rounded-2xl overflow-hidden bg-white dark:bg-slate-800"
      >
        <div className="hidden lg:flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
          <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Bölümler
          </span>
          <b className="font-mono text-xs text-gray-700 dark:text-gray-300">
            {index + 1} / {total}
          </b>
        </div>
        <div className="hidden lg:block max-h-[420px] overflow-y-auto">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(i)}
              className={`ht-rail-item w-full text-left flex gap-2.5 items-start px-4 py-2.5 border-b last:border-b-0 border-gray-100 dark:border-slate-700 transition-colors ${
                i === index
                  ? 'bg-blue-50 dark:bg-blue-950/30'
                  : 'hover:bg-gray-50 dark:hover:bg-slate-900/50'
              } ${i === index && playing ? 'is-playing' : ''}`}
            >
              <span
                className={`flex-none w-6 h-6 rounded-full border text-[11px] font-mono font-bold flex items-center justify-center ${
                  i === index
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {i + 1}
              </span>
              <span className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">
                {s.title}
              </span>
              <span className="ht-rail-progress" />
            </button>
          ))}
        </div>
        {/* Mobilde yatay adım şeridi */}
        <div className="flex lg:hidden gap-2 overflow-x-auto p-3">
          {steps.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => jumpTo(i)}
              aria-label={s.title}
              className={`flex-none w-8 h-8 rounded-full border text-xs font-mono font-bold flex items-center justify-center ${
                i === index
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'bg-gray-50 dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-gray-500 dark:text-gray-400'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0 flex flex-col gap-4">
        <div
          ref={stageRef}
          className="ht-stage rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900 p-4 md:p-5"
        >
          <div aria-hidden="true">{children}</div>

          <div
            className={`ht-spotlight ${targetRect ? 'is-visible' : ''}`}
            style={
              targetRect
                ? {
                    left: targetRect.left,
                    top: targetRect.top,
                    width: targetRect.width,
                    height: targetRect.height,
                  }
                : undefined
            }
          />
          {targetRect && (
            <span
              key={index}
              className="ht-cursor-dot is-visible is-ping"
              style={{ left: targetRect.left + targetRect.width / 2, top: targetRect.top + targetRect.height / 2 }}
            />
          )}
          {targetRect && step && (
            <div
              role="status"
              aria-live="polite"
              className={`ht-callout is-visible ${placeBelow ? 'placement-below' : 'placement-above'} bg-slate-900 text-white dark:bg-blue-600 dark:text-slate-950 px-3 py-2 rounded-lg text-[13px] font-semibold leading-snug shadow-lg`}
              style={{
                left: Math.min(targetRect.left, Math.max(8, (stageRef.current?.clientWidth ?? 320) - 320)),
                top: placeBelow ? targetRect.top + targetRect.height + 14 : targetRect.top - 14,
                transform: placeBelow ? 'translateY(0)' : 'translateY(-100%)',
              }}
            >
              {step.title}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prev}
              disabled={index === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-400"
            >
              <ChevronLeft size={16} /> Önceki
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
            >
              {playing ? <Pause size={16} /> : <Play size={16} />}
              {playing ? 'Duraklat' : 'Oynat'}
            </button>
            <button
              type="button"
              onClick={next}
              disabled={index === total - 1}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 disabled:opacity-40 disabled:cursor-not-allowed hover:border-blue-400"
            >
              Sonraki <ChevronRight size={16} />
            </button>
          </div>
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            {index + 1} / {total}
          </span>
        </div>

        {step && (
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 md:p-5">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
              Bölüm {index + 1} / {total}
            </p>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{step.title}</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 max-w-[65ch]">{step.body}</p>
          </div>
        )}
      </div>
    </div>
  );
}
