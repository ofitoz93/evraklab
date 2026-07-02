import { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import {
  PenTool,
  Type,
  Eraser,
  Undo2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Upload,
  Download,
  Loader,
} from 'lucide-react';

if (typeof window !== 'undefined' && 'GlobalWorkerOptions' in pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
}

interface ToolProps {
  processing: boolean;
  setProcessing: (v: boolean) => void;
  recordUsage: () => Promise<void>;
  resultMessage: string | null;
  setResultMessage: (v: string | null) => void;
}

type Point = { x: number; y: number };
type StrokeAction = { kind: 'stroke' | 'erase'; color: string; width: number; points: Point[] };
type TextAction = { kind: 'text'; color: string; fontSize: number; x: number; y: number; text: string };
type PageAction = StrokeAction | TextAction;
type Dims = { width: number; height: number };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1];
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function drawActionsOnCtx(ctx: CanvasRenderingContext2D, actions: PageAction[]) {
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

export default function PdfAnnotateTool({ processing, setProcessing, recordUsage, resultMessage, setResultMessage }: ToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [renderingPage, setRenderingPage] = useState(false);

  const [tool, setTool] = useState<'pen' | 'text' | 'eraser'>('pen');
  const [color, setColor] = useState('#ef4444');
  const [lineWidth, setLineWidth] = useState(3);
  const [fontSize, setFontSize] = useState(20);

  const [pageActions, setPageActions] = useState<Record<number, PageAction[]>>({});
  const [pageDims, setPageDims] = useState<Dims | null>(null);
  const pageCanvasDimsRef = useRef<Record<number, Dims>>({});

  const [textInputPos, setTextInputPos] = useState<Point | null>(null);
  const [textInputValue, setTextInputValue] = useState('');

  const fileRef = useRef<HTMLInputElement>(null);
  const baseCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef<Point[]>([]);

  // Sayfa değiştikçe PDF'i tekrar render et ve o sayfaya ait kayıtlı çizim/yazıları geri yükle
  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      setRenderingPage(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const nativeViewport = page.getViewport({ scale: 1 });
        const targetWidth = 680;
        const scale = Math.min(targetWidth / nativeViewport.width, 1.6);
        const viewport = page.getViewport({ scale });
        if (cancelled) return;

        const baseCanvas = baseCanvasRef.current;
        const overlayCanvas = overlayCanvasRef.current;
        if (!baseCanvas || !overlayCanvas) return;

        baseCanvas.width = viewport.width;
        baseCanvas.height = viewport.height;
        overlayCanvas.width = viewport.width;
        overlayCanvas.height = viewport.height;

        const baseCtx = baseCanvas.getContext('2d')!;
        await page.render({ canvasContext: baseCtx, viewport }).promise;
        if (cancelled) return;

        pageCanvasDimsRef.current[currentPage] = { width: viewport.width, height: viewport.height };
        setPageDims({ width: viewport.width, height: viewport.height });

        const overlayCtx = overlayCanvas.getContext('2d')!;
        drawActionsOnCtx(overlayCtx, pageActions[currentPage] || []);
      } finally {
        if (!cancelled) setRenderingPage(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, currentPage]);

  useEffect(() => {
    return () => {
      pdfDoc?.destroy?.();
    };
  }, [pdfDoc]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setResultMessage(null);
    setLoadingPdf(true);
    try {
      const buffer = await f.arrayBuffer();
      const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
      setFile(f);
      setPdfDoc(doc);
      setNumPages(doc.numPages);
      setCurrentPage(1);
      setPageActions({});
      pageCanvasDimsRef.current = {};
    } catch {
      alert('⛔ Bu PDF dosyası açılamadı. Lütfen geçerli bir PDF yükleyin.');
      setFile(null);
      setPdfDoc(null);
    } finally {
      setLoadingPdf(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = overlayCanvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!pageDims) return;
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
    if (ctx) drawActionsOnCtx(ctx, nextActions);
  };

  const currentPageActions = pageActions[currentPage] || [];

  const handleUndo = () => {
    if (currentPageActions.length === 0) return;
    const next = currentPageActions.slice(0, -1);
    setPageActions((prev) => ({ ...prev, [currentPage]: next }));
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, next);
  };

  const handleClearPage = () => {
    if (currentPageActions.length === 0) return;
    if (!window.confirm('Bu sayfadaki tüm çizim ve yazıları temizlemek istediğinize emin misiniz?')) return;
    setPageActions((prev) => ({ ...prev, [currentPage]: [] }));
    const ctx = overlayCanvasRef.current?.getContext('2d');
    if (ctx) drawActionsOnCtx(ctx, []);
  };

  const handleSaveDownload = async () => {
    if (!file || !pdfDoc) return;
    const hasAnyAnnotation = Object.values(pageActions).some((a) => a && a.length > 0);
    if (!hasAnyAnnotation) {
      alert('⚠️ Henüz herhangi bir sayfaya çizim veya yazı eklemediniz.');
      return;
    }

    setProcessing(true);
    setResultMessage(null);
    try {
      const origBuffer = await file.arrayBuffer();
      const pdfLibDoc = await PDFDocument.load(origBuffer, { ignoreEncryption: true });
      const libPages = pdfLibDoc.getPages();

      let annotatedCount = 0;
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

        const scaledActions: PageAction[] = actions.map((a) =>
          a.kind === 'text'
            ? { ...a, x: a.x * ratioX, y: a.y * ratioY, fontSize: a.fontSize * ratioY }
            : { ...a, width: a.width * ratioX, points: a.points.map((p) => ({ x: p.x * ratioX, y: p.y * ratioY })) }
        );

        drawActionsOnCtx(exportCtx, scaledActions);

        const pngBytes = dataUrlToBytes(exportCanvas.toDataURL('image/png'));
        const pngImage = await pdfLibDoc.embedPng(pngBytes);
        const { width: pw, height: ph } = libPages[i].getSize();
        libPages[i].drawImage(pngImage, { x: 0, y: 0, width: pw, height: ph });
        annotatedCount++;
      }

      const outBytes = await pdfLibDoc.save();
      const blob = new Blob([outBytes.slice().buffer], { type: 'application/pdf' });
      downloadBlob(blob, `duzenlenmis_${file.name}`);

      await recordUsage();
      setResultMessage(`✅ ${annotatedCount} sayfaya eklenen çizim/yazı ile PDF başarıyla kaydedildi ve indirildi!`);
    } catch (err: any) {
      setResultMessage(`❌ Hata: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  if (!file) {
    return (
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 transition"
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        {loadingPdf ? (
          <>
            <Loader size={28} className="mx-auto text-teal-500 animate-spin mb-2" />
            <p className="font-bold text-gray-600">PDF yükleniyor...</p>
          </>
        ) : (
          <>
            <Upload size={28} className="mx-auto text-gray-400 mb-2" />
            <p className="font-bold text-gray-700">Üzerine çizim/yazı eklemek için bir PDF seçin</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      {/* Araç çubuğu */}
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
      </div>

      {/* Sayfa görünümü */}
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
            style={{ cursor: tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
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
        </div>
      </div>

      {/* Alt aksiyonlar */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button onClick={() => fileRef.current?.click()} className="text-xs font-bold text-gray-500 hover:text-gray-700 flex items-center gap-1">
          <Upload size={12} /> Farklı dosya seç
        </button>
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <button
          disabled={processing}
          onClick={handleSaveDownload}
          className="ml-auto bg-teal-600 hover:bg-teal-700 disabled:bg-gray-300 text-white font-bold py-2.5 px-5 rounded-xl transition flex items-center justify-center gap-2 text-sm"
        >
          {processing ? <Loader size={16} className="animate-spin" /> : <Download size={16} />}
          {processing ? 'Kaydediliyor...' : 'Kaydet ve İndir'}
        </button>
      </div>

      {resultMessage && (
        <div
          className={`p-3 rounded-lg text-sm font-medium whitespace-pre-line flex-shrink-0 ${resultMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
        >
          {resultMessage}
        </div>
      )}
    </div>
  );
}
