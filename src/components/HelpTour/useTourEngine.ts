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
  // Rehber açılır açılmaz spot ışığı efekti (hemen ekranı karartan) devreye
  // giriyordu — kullanıcı "Oynat"a hiç basmadan sahne kararıyor, oynatmanın
  // başlayıp başlamadığı belli olmuyordu. `hasStarted`, kullanıcı gerçekten
  // bir etkileşim (oynat/ileri/geri/adım seç) yapana kadar false kalır; bu
  // sürede sahne kararmaz, bunun yerine net bir "Oynat" afişi gösterilir.
  const [hasStarted, setHasStarted] = useState(false);
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
    // Hedef eleman henüz layout almamışsa (0x0) spot ışığının "deliği" de
    // görünmez oluyor — tüm sahne delik olmadan kararmış gibi görünüyordu.
    // Görünür bir minimum boyut garantisi, bunun önüne geçer.
    const minSize = 24;
    // Uygulama genelinde `html { zoom: 85% }` uygulanıyor (bkz. index.css).
    // getBoundingClientRect() zaten zoom uygulanmış (ekranda görünen) piksel
    // değerlerini döndürüyor; bu değerler doğrudan yeni bir elemente inline
    // stil (left/top/width/height) olarak yazılırsa — o eleman da AYNI
    // zoom'lu <html> ağacının içinde olduğundan — zoom bir kez daha
    // uygulanıyor. Sonuç: spot ışığı/imleç/balon hem küçük hem de sola-yukarı
    // kaymış görünüyordu. Zoom oranına bölerek "zoom uygulanmamış" değere
    // geri döndürüyoruz ki tekrar zoomlanınca doğru konum/boyuta otursun.
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1;
    setTargetRect({
      left: (targetBox.left - stageBox.left - pad) / zoom,
      top: (targetBox.top - stageBox.top - pad) / zoom,
      width: Math.max(targetBox.width + pad * 2, minSize) / zoom,
      height: Math.max(targetBox.height + pad * 2, minSize) / zoom,
    });
  }, [index, steps, stageRef]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    const step = steps[index];
    if (stage && step) {
      const target = stage.querySelector<HTMLElement>(`[data-tour="${step.id}"]`);
      target?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    }
    // scrollIntoView'ın "smooth" kaydırma animasyonu, kaydırılan mesafeye göre
    // değişken sürede biter; tek seferlik sabit bir gecikmeden (eski: 260ms)
    // sonra ölçüm yapmak, uzun kaydırmalarda animasyon bitmeden ölçüldüğü için
    // spot ışığının yanlış/eksik bir konumda donup kalmasına yol açıyordu.
    // Bunun yerine kaydırma boyunca birkaç kez yeniden ölçülür; son ölçüm
    // neredeyse her zaman kaydırma bittikten sonraya denk gelir.
    if (reducedMotion) {
      const timeout = window.setTimeout(measure, 0);
      return () => window.clearTimeout(timeout);
    }
    const delays = [50, 150, 300, 450, 650, 850];
    const timeouts = delays.map((d) => window.setTimeout(measure, d));
    return () => timeouts.forEach((t) => window.clearTimeout(t));
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
    else {
      setHasStarted(true);
      setPlaying(true);
    }
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
    setHasStarted(true);
    goTo(index + 1);
  }, [stop, goTo, index]);

  const prev = useCallback(() => {
    stop();
    setHasStarted(true);
    goTo(index - 1);
  }, [stop, goTo, index]);

  const jumpTo = useCallback(
    (i: number) => {
      stop();
      setHasStarted(true);
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
    hasStarted,
    reducedMotion,
    next,
    prev,
    jumpTo,
    togglePlay,
  };
}
