import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import type { RefObject } from 'react';
import type { TourStep } from './types';

export interface TourRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function useTourEngine(steps: TourStep[], stageRef: RefObject<HTMLDivElement | null>) {
  const [index, setIndexState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [targetRect, setTargetRect] = useState<TourRect | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const measure = useCallback(() => {
    const stage = stageRef.current;
    const step = steps[index];
    if (!stage || !step) return;
    const target = stage.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
    if (!target) {
      setTargetRect(null);
      return;
    }
    const stageBox = stage.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const pad = 6;
    setTargetRect({
      left: targetBox.left - stageBox.left - pad,
      top: targetBox.top - stageBox.top - pad,
      width: targetBox.width + pad * 2,
      height: targetBox.height + pad * 2,
    });
  }, [index, steps, stageRef]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const step = steps[index];
    if (stage && step) {
      const target = stage.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
      target?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    const timeout = window.setTimeout(measure, reducedMotion ? 0 : 260);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, steps.length]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(stage);
    return () => ro.disconnect();
  }, [measure, stageRef]);

  const goTo = useCallback(
    (i: number) => setIndexState(Math.max(0, Math.min(steps.length - 1, i))),
    [steps.length]
  );

  const stop = useCallback(() => {
    setPlaying(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) stop();
    else setPlaying(true);
  }, [playing, stop]);

  useEffect(() => {
    if (!playing) return;
    intervalRef.current = window.setInterval(() => {
      setIndexState((i) => {
        if (i >= steps.length - 1) {
          stop();
          return i;
        }
        return i + 1;
      });
    }, 4500);
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, steps.length]);

  const next = useCallback(() => {
    stop();
    goTo(index + 1);
  }, [stop, goTo, index]);

  const prev = useCallback(() => {
    stop();
    goTo(index - 1);
  }, [stop, goTo, index]);

  const jumpTo = useCallback(
    (i: number) => {
      stop();
      goTo(i);
    },
    [stop, goTo]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') next();
      if (e.key === 'ArrowLeft') prev();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [next, prev]);

  return {
    index,
    step: steps[index] as TourStep | undefined,
    total: steps.length,
    targetRect,
    playing,
    reducedMotion,
    next,
    prev,
    jumpTo,
    togglePlay,
  };
}
