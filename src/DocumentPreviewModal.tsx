import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  PenTool,
  Type,
  Eraser,
  ImagePlus,
  Undo2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  Check,
  Loader,
  FileText as FileIcon,
} from 'lucide-react';

if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

type Point = { x: number; y: number };
type StrokeAction = { kind: 'stroke' | 'erase'; color: string; width: number; points: Point[] };
type TextAction = { kind: 'text'; color: string; fontSize: number; x: number; y: number; text: string };
type ImageAction = { kind: 'image'; dataUrl: string; x: number; y: number; width: number; height: number };
type PageAction = StrokeAction | TextAction | ImageAction;
type Dims = { width: number; height: number };

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function drawActionsOnCtx(
  ctx: CanvasRenderingContext2D,
  actions: PageAction[],
  imageCache: Record<string, HTMLImageElement>
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  actions.forEach((action) => {
    if (action.kind === 'text') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = action.color;
      ctx.font = `${action.fontSize}px sans-serif`;
      ctx.textBaseline = 'top';
      action.text.split('\n').forEach((line, i) => {
        ctx.fillText(line, action.x, action.y + i * action.fontSize * 1.25);
      });
    } else if (action.kind === 'image') {
      const img = imageCache[action.dataUrl];
      if (img) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(img, action.x, action.y, action.width, action.height);
      }
    } else {
      ctx.globalCompositeOperation = action.kind === 'erase' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = action.color;
      ctx.lineWidth = action.width;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      action.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.stroke();
    }
  });
  ctx.globalCompositeOperation = 'source-over';
}

function detectKind(file: File): 'pdf' | 'image' | 'unsupported' {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (file.type === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return 'image';
  return 'unsupported';
}

function ToolButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold transition ${active ? 'bg-teal-500 text-white' : 'text-gray-500 hover:bg-gray-100'
        }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

interface Props {
  file: File;
  onClose: () => void;
  onConfirm: (finalFile: File) => void;
  confirmLabel?: string;
  readOnly?: boolean;
}

export default function DocumentPreviewModal({ file, onClose, onConfirm, confirmLabel = 'Onayla ve Kaydet', readOnly = false }: Props) {
  const kind = detectKind(file);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);

  const [tool, setTool] = useState<'pen' | 'text' | 'eraser'>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(20);

  const [pageActions, setPageActions] = useState<Record<number, PageAction[]>>({});
  const [pageDims, setPageDims] = useState<Dims | null>(null);
  const pageCanvasDimsRef = useRef<Record<number, Dims>>({});
  const imageCacheRef = useRef<Record<string, HTMLImageElement>>({});

  const [textInputPos, setTextInputPos] = useState<Point | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const [activeImage, setActiveImage] = useState<{ dataUrl: string; x: number; y: number; width: number; height: number } | null>(null);
  const dragStateRef = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; orig: { x: number; y: number; width: number; height: number } } | null>(null);

  const [saving, setSaving] = useState(false);

  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);

  // Dosyayı bir kere yükle: PDF ise pdf.js dokümanı, görsel ise Image nesnesi.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingDoc(true);
      setLoadError(false);
      try {
        if (kind === 'pdf') {
          const buffer = await file.arrayBuffer();
          const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
          if (cancelled) return;
          setPdfDoc(doc);
          setNumPages(doc.numPages);
          setCurrentPage(1);
        } else if (kind === 'image') {
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const im = new Image();
            im.onload = () => resolve(im);
            im.onerror = reject;
            im.src = dataUrl;
          });
          if (cancelled) return;
          setImageEl(img);
          setNumPages(1);
          setCurrentPage(1);
        }
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      pdfDoc?.destroy?.();
    };
  }, [pdfDoc]);

  // Sayfa değişince (PDF sayfası ya da tekil görsel) canvas'a yeniden çiz.
  useEffect(() => {
    if (kind === 'unsupported') return;
    if (kind === 'pdf' && !pdfDoc) return;
    if (kind === 'image' && !imageEl) return;
    let cancelled = false;
    (async () => {
      setRenderingPage(true);
      try {
        const baseCanvas = baseCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!baseCanvas || !overlayCanvas) return;

        let width: number;
        let height: number;

        if (kind === 'pdf') {
          const page = await pdfDoc.getPage(currentPage);
          const nativeViewport = page.getViewport({ scale: 1 });
          const targetWidth = 680;
          const scale = Math.min(targetWidth / nativeViewport.width, 1.6);
          const viewport = page.getViewport({ scale });
          if (cancelled) return;
          width = viewport.width;
          height = viewport.height;
          baseCanvas.width = width;
          baseCanvas.height = height;
          overlayCanvas.width = width;
          overlayCanvas.height = height;
          const baseCtx = baseCanvas.getContext('2d')!;
          await page.render({ canvasContext: baseCtx, viewport }).promise;
          if (cancelled) return;
        } else {
          const targetWidth = 680;
          const scale = Math.min(targetWidth / imageEl!.width, 1.6);
          width = imageEl!.width * scale;
          height = imageEl!.height * scale;
          baseCanvas.width = width;
          baseCanvas.height = height;
          overlayCanvas.width = width;
          overlayCanvas.height = height;
          const baseCtx = baseCanvas.getContext('2d')!;
          baseCtx.clearRect(0, 0, width, height);
          baseCtx.drawImage(imageEl!, 0, 0, width, height);
        }

        pageCanvasDimsRef.current[currentPage] = { width, height };
        setPageDims({ width, height });

        const overlayCtx = overlayCanvas.getContext('2d')!;
        drawActionsOnCtx(overlayCtx, pageActions[currentPage] || [], imageCacheRef.current);
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, imageEl, currentPage, kind]);

  // Sayfa değiştiğinde henüz yerleştirilmemiş görsel taslağını iptal et.
  useEffect(() => {
    setActiveImage(null);
  }, [currentPage]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (readOnly || !pageDims || activeImage) return;
    const pos = getPos(e);

    if (tool === 'text') {
      setTextInputPos(pos);
      setTextInputValue('');
      return;
    }

    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    currentStrokeRef.current = [pos];

    const ctx = overlayCanvasRef.current!.getContext('2d')!;
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
    ctx.strokeStyle = color;
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 3 : lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    currentStrokeRef.current.push(pos);
    const ctx = overlayCanvasRef.current!.getContext('2d')!;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    const points = currentStrokeRef.current;
    currentStrokeRef.current = [];
    if (points.length < 2) return;

    const action: StrokeAction = {
      kind: tool === 'eraser' ? 'erase' : 'stroke',
      color,
      width: tool === 'eraser' ? lineWidth * 3 : lineWidth,
      points,
    };
    setPageActions((prev) => ({ ...prev, [currentPage]: [...(prev[currentPage] || []), action] }));
  };

  const commitTextInput = () => {
    if (!textInputPos) return;
    const value = textInputValue.trim();
    const pos = textInputPos;
    setTextInputPos(null);
    setTextInputValue('');
    if (!value) return;

    const action: TextAction = { kind: 'text', color, fontSize, x: pos.x, y: pos.y, text: value };
    const nextActions = [...(pageActions[currentPage] || []), action];
    setPageActions((prev) => ({ ...prev, [currentPage]: nextActions }));

    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, nextActions, imageCacheRef.current);
  };

  const currentPageActions = pageActions[currentPage] || [];

  const handleUndo = () => {
    if (currentPageActions.length === 0) return;
    const next = currentPageActions.slice(0, -1);
    setPageActions((prev) => ({ ...prev, [currentPage]: next }));
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, next, imageCacheRef.current);
  };

  const handleClearPage = () => {
    if (currentPageActions.length === 0) return;
    if (!window.confirm('Bu sayfadaki tüm çizim, yazı ve görselleri temizlemek istediğinize emin misiniz?')) return;
    setPageActions((prev) => ({ ...prev, [currentPage]: [] }));
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, [], imageCacheRef.current);
  };

  const handlePickImage = () => imageInputRef.current?.click();

  const handleImageFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (e.target) e.target.value = '';
    if (!f || !pageDims) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new Image();
      img.onload = () => {
        imageCacheRef.current[dataUrl] = img;
        const maxW = pageDims.width * 0.45;
        const maxH = pageDims.height * 0.45;
        const scale = Math.min(1, maxW / img.width, maxH / img.height);
        const width = Math.max(20, img.width * scale);
        const height = Math.max(20, img.height * scale);
        setActiveImage({
          dataUrl,
          x: (pageDims.width - width) / 2,
          y: (pageDims.height - height) / 2,
          width,
          height,
        });
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(f);
  };

  const handleImageDragPointerDown = (e: React.PointerEvent, mode: 'move' | 'resize') => {
    if (!activeImage) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      orig: { x: activeImage.x, y: activeImage.y, width: activeImage.width, height: activeImage.height },
    };
  };

  const handleImageDragPointerMove = (e: React.PointerEvent) => {
    const state = dragStateRef.current;
    if (!state || !activeImage) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (state.mode === 'move') {
      setActiveImage({ ...activeImage, x: state.orig.x + dx, y: state.orig.y + dy });
    } else {
      const aspect = state.orig.width / state.orig.height;
      const width = Math.max(24, state.orig.width + dx);
      const height = width / aspect;
      setActiveImage({ ...activeImage, width, height });
    }
  };

  const handleImageDragPointerUp = () => {
    dragStateRef.current = null;
  };

  const commitActiveImage = () => {
    if (!activeImage) return;
    const action: ImageAction = { kind: 'image', ...activeImage };
    const nextActions = [...(pageActions[currentPage] || []), action];
    setPageActions((prev) => ({ ...prev, [currentPage]: nextActions }));
    setActiveImage(null);
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, nextActions, imageCacheRef.current);
  };

  const cancelActiveImage = () => setActiveImage(null);

  const scaleActionsForExport = (actions: PageAction[], ratioX: number, ratioY: number): PageAction[] =>
    actions.map((a) => {
      if (a.kind === 'text') return { ...a, x: a.x * ratioX, y: a.y * ratioY, fontSize: a.fontSize * ratioY };
      if (a.kind === 'image') return { ...a, x: a.x * ratioX, y: a.y * ratioY, width: a.width * ratioX, height: a.height * ratioY };
      return { ...a, width: a.width * ratioX, points: a.points.map((p) => ({ x: p.x * ratioX, y: p.y * ratioY })) };
    });

  const buildFlattenedPdf = async (): Promise<File> => {
    const origBuffer = await file.arrayBuffer();
    const pdfLibDoc = await PDFDocument.load(origBuffer, { ignoreEncryption: true });
    const libPages = pdfLibDoc.getPages();

    for (let i = 0; i < libPages.length; i++) {
      const pageNum = i + 1;
      const actions = pageActions[pageNum];
      if (!actions || actions.length === 0) continue;

      const jsPage = await pdfDoc.getPage(pageNum);
      const exportScale = 2.5;
      const exportViewport = jsPage.getViewport({ scale: exportScale });

      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = Math.round(exportViewport.width);
      exportCanvas.height = Math.round(exportViewport.height);
      const exportCtx = exportCanvas.getContext('2d')!;

      const sourceDims = pageCanvasDimsRef.current[pageNum];
      const ratioX = sourceDims ? exportCanvas.width / sourceDims.width : 1;
      const ratioY = sourceDims ? exportCanvas.height / sourceDims.height : 1;

      drawActionsOnCtx(exportCtx, scaleActionsForExport(actions, ratioX, ratioY), imageCacheRef.current);

      const pngBytes = dataUrlToBytes(exportCanvas.toDataURL('image/png'));
      const pngImage = await pdfLibDoc.embedPng(pngBytes);
      const { width: pw, height: ph } = libPages[i].getSize();
      libPages[i].drawImage(pngImage, { x: 0, y: 0, width: pw, height: ph });
    }

    const outBytes = await pdfLibDoc.save();
    return new File([outBytes.slice().buffer], file.name, { type: 'application/pdf' });
  };

  const buildFlattenedImage = async (): Promise<File> => {
    const actions = pageActions[1] || [];
    const exportScale = 2.5;
    const exportWidth = Math.round(imageEl!.width * exportScale);
    const exportHeight = Math.round(imageEl!.height * exportScale);
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const exportCtx = exportCanvas.getContext('2d')!;
    exportCtx.drawImage(imageEl!, 0, 0, exportWidth, exportHeight);

    const sourceDims = pageCanvasDimsRef.current[1];
    const ratioX = sourceDims ? exportWidth / sourceDims.width : 1;
    const ratioY = sourceDims ? exportHeight / sourceDims.height : 1;

    drawActionsOnCtx(exportCtx, scaleActionsForExport(actions, ratioX, ratioY), imageCacheRef.current);

    const blob: Blob = await new Promise((resolve, reject) =>
      exportCanvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Görsel oluşturulamadı'))), file.type || 'image/png')
    );
    return new File([blob], file.name, { type: file.type || 'image/png' });
  };

  const hasAnyAnnotation = Object.values(pageActions).some((a) => a && a.length > 0);

  const handleConfirm = async () => {
    if (kind === 'unsupported' || !hasAnyAnnotation) {
      onConfirm(file);
      return;
    }
    setSaving(true);
    try {
      const finalFile = kind === 'pdf' ? await buildFlattenedPdf() : await buildFlattenedImage();
      onConfirm(finalFile);
    } catch (err: any) {
      alert('Önizleme kaydedilirken hata oluştu: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b flex-shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800">{readOnly ? 'Belge Önizleme' : 'Önizleme ve Görsel Ekle'}</h3>
            <p className="text-xs text-gray-400 truncate">{file.name}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 flex-shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Gövde */}
        <div className="flex-1 min-h-0 flex flex-col gap-3 p-4">
          {loadingDoc ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 gap-2">
              <Loader className="animate-spin" size={20} /> Belge yükleniyor...
            </div>
          ) : loadError || kind === 'unsupported' ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-500">
              <FileIcon size={40} className="text-gray-300" />
              <p className="font-bold text-sm">{file.name}</p>
              <p className="text-xs text-center max-w-xs">
                {loadError ? 'Bu dosya önizlenemedi.' : 'Bu dosya türü için görsel önizleme desteklenmiyor.'}
              </p>
            </div>
          ) : (
            <>
              {!readOnly && (
                <div className="flex flex-wrap items-center gap-2 bg-gray-50 border rounded-xl p-2 flex-shrink-0">
                  <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
                    <ToolButton active={tool === 'pen'} onClick={() => setTool('pen')} icon={<PenTool size={16} />} label="Kalem" />
                    <ToolButton active={tool === 'text'} onClick={() => setTool('text')} icon={<Type size={16} />} label="Yazı" />
                    <ToolButton active={tool === 'eraser'} onClick={() => setTool('eraser')} icon={<Eraser size={16} />} label="Silgi" />
                  </div>

                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer border"
                    title="Renk"
                  />

                  {tool !== 'text' ? (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Kalınlık</span>
                      <input type="range" min={1} max={12} value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} className="w-20" />
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <span>Boyut</span>
                      <input type="range" min={10} max={48} value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-20" />
                    </div>
                  )}

                  <button
                    onClick={handleUndo}
                    disabled={currentPageActions.length === 0}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600"
                    title="Geri Al"
                  >
                    <Undo2 size={16} />
                  </button>
                  <button
                    onClick={handleClearPage}
                    disabled={currentPageActions.length === 0}
                    className="p-2 rounded-lg hover:bg-red-50 disabled:opacity-30 text-red-500"
                    title="Sayfayı Temizle"
                  >
                    <Trash2 size={16} />
                  </button>

                  {activeImage ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={commitActiveImage}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold bg-teal-500 text-white"
                      >
                        <Check size={14} /> Yerleştir
                      </button>
                      <button
                        onClick={cancelActiveImage}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100"
                      >
                        <X size={14} /> İptal
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handlePickImage}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100"
                    >
                      <ImagePlus size={16} /> <span className="hidden sm:inline">Görsel Ekle</span>
                    </button>
                  )}
                  <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFileSelected} />

                  {numPages > 1 && (
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage <= 1}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-xs font-bold text-gray-600 min-w-[60px] text-center">
                        {currentPage} / {numPages}
                      </span>
                      <button
                        onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                        disabled={currentPage >= numPages}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {readOnly && numPages > 1 && (
                <div className="flex items-center justify-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600 border"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-xs font-bold text-gray-600 min-w-[60px] text-center">
                    {currentPage} / {numPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
                    disabled={currentPage >= numPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-600 border"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              <div className="flex-1 min-h-0 overflow-auto bg-gray-100 rounded-xl border flex items-start justify-center p-4">
                <div className="relative inline-block shadow-md" style={pageDims ? { width: pageDims.width, height: pageDims.height } : undefined}>
                  {renderingPage && (
                    <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-20">
                      <Loader className="animate-spin text-teal-500" size={24} />
                    </div>
                  )}
                  <canvas ref={baseCanvasRef} className="absolute top-0 left-0 max-w-none" />
                  <canvas
                    ref={overlayCanvasRef}
                    className="absolute top-0 left-0 max-w-none touch-none"
                    style={{ cursor: readOnly ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                  {textInputPos && (
                    <textarea
                      autoFocus
                      value={textInputValue}
                      onChange={(e) => setTextInputValue(e.target.value)}
                      onBlur={commitTextInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setTextInputPos(null);
                          setTextInputValue('');
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          commitTextInput();
                        }
                      }}
                      placeholder="Yazın, Enter ile ekleyin..."
                      style={{
                        position: 'absolute',
                        left: textInputPos.x,
                        top: textInputPos.y,
                        color,
                        fontSize,
                        fontFamily: 'sans-serif',
                        border: '1px dashed #14b8a6',
                        background: 'rgba(255,255,255,0.9)',
                        padding: '2px 4px',
                        minWidth: 140,
                        lineHeight: 1.25,
                        outline: 'none',
                        zIndex: 10,
                      }}
                    />
                  )}
                  {activeImage && (
                    <div
                      className="absolute border-2 border-dashed border-teal-500 cursor-move touch-none"
                      style={{ left: activeImage.x, top: activeImage.y, width: activeImage.width, height: activeImage.height, zIndex: 15 }}
                      onPointerDown={(e) => handleImageDragPointerDown(e, 'move')}
                      onPointerMove={handleImageDragPointerMove}
                      onPointerUp={handleImageDragPointerUp}
                      onPointerLeave={handleImageDragPointerUp}
                    >
                      <img src={activeImage.dataUrl} draggable={false} className="w-full h-full object-contain pointer-events-none select-none" alt="Eklenen görsel" />
                      <div
                        className="absolute -right-2 -bottom-2 w-4 h-4 bg-teal-600 rounded-full border-2 border-white cursor-nwse-resize touch-none"
                        onPointerDown={(e) => handleImageDragPointerDown(e, 'resize')}
                        onPointerMove={handleImageDragPointerMove}
                        onPointerUp={handleImageDragPointerUp}
                        onPointerLeave={handleImageDragPointerUp}
                      />
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Alt bar */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t flex-shrink-0 bg-gray-50">
          <button onClick={onClose} disabled={saving} className="px-5 py-2.5 rounded-xl font-bold text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-50">
            {readOnly ? 'Kapat' : 'İptal'}
          </button>
          {!readOnly && (
            <button
              onClick={handleConfirm}
              disabled={saving || loadingDoc}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? <Loader size={16} className="animate-spin" /> : <Check size={16} />}
              {saving ? 'Hazırlanıyor...' : confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
