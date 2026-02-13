import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './supabaseClient';
import { PDFDocument } from 'pdf-lib';
import {
  Scissors,
  FileCheck,
  Image,
  Minimize2,
  Lock,
  Unlock,
  Crown,
  AlertCircle,
  Loader,
  X,
  Upload,
  Download,
  FileText,
  Info,
  Plus,
  Trash2,
} from 'lucide-react';

// --- YARDIMCI FONKSİYONLAR ---
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// --- ANA BİLEŞEN ---
export default function Tools() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [dailyUsage, setDailyUsage] = useState(0);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const FREE_LIMIT = 2;

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
      setProfile(data);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from('tool_usages')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .gte('created_at', today.toISOString());
      setDailyUsage(count || 0);
    }
    setLoading(false);
  };

  const isPremium =
    profile?.role?.includes('premium') ||
    profile?.role === 'admin' ||
    profile?.org_role === 'owner';

  const canUse = isPremium || dailyUsage < FREE_LIMIT;

  const recordUsage = async (toolName: string) => {
    if (!profile) return;
    await supabase.from('tool_usages').insert([
      { user_id: profile.id, tool_name: toolName },
    ]);
    setDailyUsage((prev) => prev + 1);
  };

  const openTool = (toolId: string) => {
    if (!canUse) {
      alert('⚠️ Günlük işlem limitiniz doldu. Sınırsız kullanım için Premium\'a geçin.');
      return;
    }
    setResultMessage(null);
    setActiveTool(toolId);
  };

  const tools = [
    {
      id: 'pdf-split',
      name: 'PDF Böl',
      icon: <Scissors size={32} />,
      desc: 'PDF sayfalarını tek tek ayırın.',
      color: 'text-red-500 bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      id: 'pdf-merge',
      name: 'PDF Birleştir',
      icon: <FileCheck size={32} />,
      desc: 'Birden fazla PDF\'i tek dosya yapın.',
      color: 'text-blue-500 bg-blue-50',
      borderColor: 'border-blue-200',
    },
    {
      id: 'pdf-compress',
      name: 'PDF Sıkıştır',
      icon: <Minimize2 size={32} />,
      desc: 'Dosya boyutunu optimize edin.',
      color: 'text-green-500 bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      id: 'img-pdf',
      name: 'Resimden PDF',
      icon: <Image size={32} />,
      desc: 'JPG/PNG dosyalarını PDF yapın.',
      color: 'text-purple-500 bg-purple-50',
      borderColor: 'border-purple-200',
    },
    {
      id: 'pdf-lock',
      name: 'PDF Şifrele',
      icon: <Lock size={32} />,
      desc: 'Dosyalarınıza şifre koyun.',
      color: 'text-orange-500 bg-orange-50',
      borderColor: 'border-orange-200',
      comingSoon: true,
    },
    {
      id: 'pdf-unlock',
      name: 'Şifre Kaldır',
      icon: <Unlock size={32} />,
      desc: 'PDF şifresini kaldırın.',
      color: 'text-gray-500 bg-gray-50',
      borderColor: 'border-gray-200',
      comingSoon: true,
    },
  ];

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader className="animate-spin text-blue-600 mr-2" /> Yükleniyor...
      </div>
    );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 pb-24">
      {/* BAŞLIK */}
      <div className="text-center mb-12">
        <h1 className="text-3xl font-black text-gray-900 mb-2">
          Pratik PDF Araçları
        </h1>
        <p className="text-gray-500">
          Tüm belge işlemleriniz için hızlı ve güvenli çözümler.
        </p>

        {/* LİMİT BİLGİSİ */}
        <div className="mt-6 inline-flex items-center gap-4 bg-white p-2 pr-6 rounded-full shadow-sm border border-gray-200">
          <div
            className={`p-2 rounded-full ${isPremium
                ? 'bg-yellow-100 text-yellow-600'
                : 'bg-gray-100 text-gray-600'
              }`}
          >
            {isPremium ? <Crown size={20} /> : <AlertCircle size={20} />}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-gray-400 uppercase">
              GÜNLÜK HAKKINIZ
            </div>
            <div className="text-sm font-bold text-gray-800">
              {isPremium ? (
                <span className="text-yellow-600">SINIRSIZ Erişim</span>
              ) : (
                <span>
                  {dailyUsage} / {FREE_LIMIT} Kullanıldı
                </span>
              )}
            </div>
          </div>
          {!isPremium && (
            <a
              href="/pricing"
              className="text-xs font-bold text-blue-600 hover:underline ml-2"
            >
              Limiti Kaldır
            </a>
          )}
        </div>
      </div>

      {/* ARAÇ KARTLARI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => tool.comingSoon ? setActiveTool(tool.id) : openTool(tool.id)}
            className="group relative bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition text-left flex flex-col gap-4"
          >
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center ${tool.color} group-hover:scale-110 transition`}
            >
              {tool.icon}
            </div>
            <div>
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                {tool.name}
                {tool.comingSoon && (
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full font-bold">
                    YAKINDA
                  </span>
                )}
              </h3>
              <p className="text-sm text-gray-500 mt-1">{tool.desc}</p>
            </div>
            {!isPremium && dailyUsage >= FREE_LIMIT && !tool.comingSoon && (
              <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] flex flex-col items-center justify-center rounded-2xl z-10">
                <Lock className="text-gray-400 mb-2" size={32} />
                <span className="text-xs font-bold text-gray-500">
                  Limit Doldu
                </span>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* MODAL */}
      {activeTool && (
        <ToolModal
          toolId={activeTool}
          tools={tools}
          onClose={() => setActiveTool(null)}
          processing={processing}
          setProcessing={setProcessing}
          recordUsage={recordUsage}
          resultMessage={resultMessage}
          setResultMessage={setResultMessage}
        />
      )}
    </div>
  );
}

// --- MODAL BİLEŞENİ ---
function ToolModal({
  toolId,
  tools,
  onClose,
  processing,
  setProcessing,
  recordUsage,
  resultMessage,
  setResultMessage,
}: {
  toolId: string;
  tools: any[];
  onClose: () => void;
  processing: boolean;
  setProcessing: (v: boolean) => void;
  recordUsage: (name: string) => Promise<void>;
  resultMessage: string | null;
  setResultMessage: (v: string | null) => void;
}) {
  const tool = tools.find((t) => t.id === toolId);
  if (!tool) return null;

  if (tool.comingSoon) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
          <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 ${tool.color}`}>
            {tool.icon}
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">{tool.name}</h2>
          <div className="flex items-center justify-center gap-2 mb-4">
            <Info size={16} className="text-orange-500" />
            <span className="text-orange-600 font-semibold text-sm">Yakında Kullanıma Açılacak</span>
          </div>
          <p className="text-gray-500 mb-6">
            Bu özellik üzerinde çalışıyoruz. Çok yakında hizmetinize sunulacak!
          </p>
          <button
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 px-8 rounded-xl transition"
          >
            Kapat
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`p-6 border-b ${tool.borderColor} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tool.color}`}>
              {React.cloneElement(tool.icon, { size: 24 })}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{tool.name}</h2>
              <p className="text-sm text-gray-500">{tool.desc}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition">
            <X size={20} />
          </button>
        </div>

        {/* İçerik */}
        <div className="p-6">
          {toolId === 'pdf-split' && (
            <PdfSplitTool
              processing={processing}
              setProcessing={setProcessing}
              recordUsage={() => recordUsage('PDF Böl')}
              resultMessage={resultMessage}
              setResultMessage={setResultMessage}
            />
          )}
          {toolId === 'pdf-merge' && (
            <PdfMergeTool
              processing={processing}
              setProcessing={setProcessing}
              recordUsage={() => recordUsage('PDF Birleştir')}
              resultMessage={resultMessage}
              setResultMessage={setResultMessage}
            />
          )}
          {toolId === 'pdf-compress' && (
            <PdfCompressTool
              processing={processing}
              setProcessing={setProcessing}
              recordUsage={() => recordUsage('PDF Sıkıştır')}
              resultMessage={resultMessage}
              setResultMessage={setResultMessage}
            />
          )}
          {toolId === 'img-pdf' && (
            <ImgToPdfTool
              processing={processing}
              setProcessing={setProcessing}
              recordUsage={() => recordUsage('Resimden PDF')}
              resultMessage={resultMessage}
              setResultMessage={setResultMessage}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// --- ORTAK PROP TİPİ ---
interface ToolProps {
  processing: boolean;
  setProcessing: (v: boolean) => void;
  recordUsage: () => Promise<void>;
  resultMessage: string | null;
  setResultMessage: (v: string | null) => void;
}

// ==============================
// 1. PDF BÖL (SPLIT)
// ==============================
function PdfSplitTool({ processing, setProcessing, recordUsage, resultMessage, setResultMessage }: ToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResultMessage(null);
    try {
      const buffer = await readFileAsArrayBuffer(f);
      const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const count = doc.getPageCount();
      setPageCount(count);
      setStartPage(1);
      setEndPage(count);
    } catch {
      alert('⛔ Bu PDF dosyası açılamadı. Lütfen geçerli bir PDF yükleyin.');
      setFile(null);
    }
  };

  const handleSplit = async () => {
    if (!file) return;
    if (startPage < 1 || endPage > pageCount || startPage > endPage) {
      alert('⚠️ Geçerli bir sayfa aralığı girin.');
      return;
    }
    setProcessing(true);
    setResultMessage(null);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
      const newDoc = await PDFDocument.create();

      const pageIndices = [];
      for (let i = startPage - 1; i < endPage; i++) {
        pageIndices.push(i);
      }
      const pages = await newDoc.copyPages(srcDoc, pageIndices);
      pages.forEach((page) => newDoc.addPage(page));

      const pdfBytes = await newDoc.save();
      const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
      downloadBlob(blob, `bolunmus_${startPage}-${endPage}.pdf`);

      await recordUsage();
      setResultMessage(`✅ Sayfalar ${startPage}-${endPage} başarıyla ayrıldı ve indirildi!`);
    } catch (err: any) {
      setResultMessage(`❌ Hata: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Dosya Seç */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition"
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <Upload size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="font-bold text-gray-700">{file ? file.name : 'PDF dosyası seçin'}</p>
        {file && <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)} · {pageCount} sayfa</p>}
      </div>

      {/* Sayfa Aralığı */}
      {file && pageCount > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border space-y-3">
          <p className="text-sm font-bold text-gray-700">Sayfa Aralığı Seçin</p>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Başlangıç</label>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={startPage}
                onChange={(e) => setStartPage(Number(e.target.value))}
                className="w-full border rounded-lg p-2 text-center font-bold"
              />
            </div>
            <span className="text-gray-400 font-bold mt-4">—</span>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Bitiş</label>
              <input
                type="number"
                min={1}
                max={pageCount}
                value={endPage}
                onChange={(e) => setEndPage(Number(e.target.value))}
                className="w-full border rounded-lg p-2 text-center font-bold"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-gray-500 mb-1 block">Toplam</label>
              <div className="bg-white border rounded-lg p-2 text-center font-bold text-gray-600">
                {pageCount} sayfa
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Buton */}
      <button
        disabled={!file || processing}
        onClick={handleSplit}
        className="w-full bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {processing ? <Loader size={18} className="animate-spin" /> : <Scissors size={18} />}
        {processing ? 'İşleniyor...' : 'PDF\'i Böl ve İndir'}
      </button>

      {/* Sonuç */}
      {resultMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium ${resultMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}

// ==============================
// 2. PDF BİRLEŞTİR (MERGE)
// ==============================
function PdfMergeTool({ processing, setProcessing, recordUsage, resultMessage, setResultMessage }: ToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    setResultMessage(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      alert('⚠️ En az 2 PDF dosyası seçmelisiniz.');
      return;
    }
    setProcessing(true);
    setResultMessage(null);
    try {
      const mergedDoc = await PDFDocument.create();

      for (const file of files) {
        const buffer = await readFileAsArrayBuffer(file);
        const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
        const pages = await mergedDoc.copyPages(doc, doc.getPageIndices());
        pages.forEach((page) => mergedDoc.addPage(page));
      }

      const pdfBytes = await mergedDoc.save();
      const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
      downloadBlob(blob, 'birlestirilmis.pdf');

      await recordUsage();
      setResultMessage(`✅ ${files.length} dosya başarıyla birleştirildi!`);
    } catch (err: any) {
      setResultMessage(`❌ Hata: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Dosya Ekle */}
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition"
      >
        <input ref={fileRef} type="file" accept=".pdf" multiple className="hidden" onChange={handleFilesSelect} />
        <Plus size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="font-bold text-gray-700">PDF dosyaları ekleyin</p>
        <p className="text-xs text-gray-400 mt-1">Birden fazla dosya seçebilirsiniz</p>
      </div>

      {/* Dosya Listesi */}
      {files.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border space-y-2">
          <p className="text-sm font-bold text-gray-700 mb-2">Seçilen Dosyalar ({files.length})</p>
          {files.map((file, index) => (
            <div key={index} className="flex items-center justify-between bg-white p-3 rounded-lg border">
              <div className="flex items-center gap-2 min-w-0">
                <FileText size={16} className="text-blue-500 flex-shrink-0" />
                <span className="text-sm font-medium truncate">{file.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatFileSize(file.size)}</span>
              </div>
              <button onClick={() => removeFile(index)} className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600 transition flex-shrink-0">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Buton */}
      <button
        disabled={files.length < 2 || processing}
        onClick={handleMerge}
        className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {processing ? <Loader size={18} className="animate-spin" /> : <FileCheck size={18} />}
        {processing ? 'Birleştiriliyor...' : 'PDF\'leri Birleştir ve İndir'}
      </button>

      {resultMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium ${resultMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}

// ==============================
// 3. PDF SIKIŞTIR (COMPRESS)
// ==============================
function PdfCompressTool({ processing, setProcessing, recordUsage, resultMessage, setResultMessage }: ToolProps) {
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResultMessage(null);
  };

  const handleCompress = async () => {
    if (!file) return;
    setProcessing(true);
    setResultMessage(null);
    try {
      const buffer = await readFileAsArrayBuffer(file);
      const srcDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });

      // Yeni bir temiz PDF oluştur - gereksiz metadata temizlenir
      const newDoc = await PDFDocument.create();
      const pages = await newDoc.copyPages(srcDoc, srcDoc.getPageIndices());
      pages.forEach((page) => newDoc.addPage(page));

      // Metadata temizle
      newDoc.setTitle('');
      newDoc.setAuthor('');
      newDoc.setSubject('');
      newDoc.setKeywords([]);
      newDoc.setProducer('EvrakLab');
      newDoc.setCreator('EvrakLab');

      const pdfBytes = await newDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });

      const originalSize = file.size;
      const compressedSize = pdfBytes.length;
      const savedPercent = Math.max(0, ((originalSize - compressedSize) / originalSize) * 100);

      const blob = new Blob([new Uint8Array(pdfBytes).buffer], { type: 'application/pdf' });
      downloadBlob(blob, `sikistirilmis_${file.name}`);

      await recordUsage();
      setResultMessage(
        `✅ Sıkıştırma tamamlandı!\n📄 Orijinal: ${formatFileSize(originalSize)}\n📦 Yeni boyut: ${formatFileSize(compressedSize)}\n💾 Kazanç: %${savedPercent.toFixed(1)}`
      );
    } catch (err: any) {
      setResultMessage(`❌ Hata: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/30 transition"
      >
        <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <Upload size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="font-bold text-gray-700">{file ? file.name : 'PDF dosyası seçin'}</p>
        {file && <p className="text-xs text-gray-400 mt-1">{formatFileSize(file.size)}</p>}
      </div>

      <button
        disabled={!file || processing}
        onClick={handleCompress}
        className="w-full bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {processing ? <Loader size={18} className="animate-spin" /> : <Minimize2 size={18} />}
        {processing ? 'Sıkıştırılıyor...' : 'PDF\'i Sıkıştır ve İndir'}
      </button>

      {resultMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium whitespace-pre-line ${resultMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}

// ==============================
// 4. RESİMDEN PDF (IMAGE TO PDF)
// ==============================
function ImgToPdfTool({ processing, setProcessing, recordUsage, resultMessage, setResultMessage }: ToolProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setFiles((prev) => [...prev, ...newFiles]);
    setResultMessage(null);

    // Önizleme oluştur
    newFiles.forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(f);
    });

    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConvert = async () => {
    if (files.length === 0) {
      alert('⚠️ En az 1 resim dosyası seçmelisiniz.');
      return;
    }
    setProcessing(true);
    setResultMessage(null);
    try {
      const pdfDoc = await PDFDocument.create();

      for (const file of files) {
        const buffer = await readFileAsArrayBuffer(file);
        const uint8 = new Uint8Array(buffer);

        let image;
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.png')) {
          image = await pdfDoc.embedPng(uint8);
        } else {
          image = await pdfDoc.embedJpg(uint8);
        }

        const page = pdfDoc.addPage([image.width, image.height]);
        page.drawImage(image, {
          x: 0,
          y: 0,
          width: image.width,
          height: image.height,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes.slice().buffer], { type: 'application/pdf' });
      downloadBlob(blob, 'resimlerden_olusturulan.pdf');

      await recordUsage();
      setResultMessage(`✅ ${files.length} resim başarıyla PDF'e dönüştürüldü!`);
    } catch (err: any) {
      setResultMessage(`❌ Hata: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div
        onClick={() => fileRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50/30 transition"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png"
          multiple
          className="hidden"
          onChange={handleFilesSelect}
        />
        <Image size={28} className="mx-auto text-gray-400 mb-2" />
        <p className="font-bold text-gray-700">Resim dosyaları seçin</p>
        <p className="text-xs text-gray-400 mt-1">JPG, JPEG, PNG</p>
      </div>

      {/* Önizleme */}
      {files.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-xl border">
          <p className="text-sm font-bold text-gray-700 mb-3">Seçilen Resimler ({files.length})</p>
          <div className="grid grid-cols-3 gap-3">
            {files.map((file, index) => (
              <div key={index} className="relative group">
                {previews[index] && (
                  <img
                    src={previews[index]}
                    alt={file.name}
                    className="w-full h-24 object-cover rounded-lg border"
                  />
                )}
                <button
                  onClick={() => removeFile(index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                >
                  <X size={12} />
                </button>
                <p className="text-[10px] text-gray-500 mt-1 truncate">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        disabled={files.length === 0 || processing}
        onClick={handleConvert}
        className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl transition flex items-center justify-center gap-2"
      >
        {processing ? <Loader size={18} className="animate-spin" /> : <Download size={18} />}
        {processing ? 'Dönüştürülüyor...' : 'PDF Oluştur ve İndir'}
      </button>

      {resultMessage && (
        <div className={`p-3 rounded-lg text-sm font-medium ${resultMessage.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {resultMessage}
        </div>
      )}
    </div>
  );
}
