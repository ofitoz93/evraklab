import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from 'docx';
import { supabase } from './supabaseClient';
import { Printer, FileDown, ArrowLeft, Check, XCircle } from 'lucide-react';

export default function OpinionLetterView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [letter, setLetter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    fetchLetter();
    fetchUser();
  }, [id]);

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setUserId(session.user.id);
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();
    if (profile) setUserRole(profile.role || '');
  };

  const fetchLetter = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('opinion_letters')
        .select('*, client:client_id(name, logo_url, address, tax_no, phone, kep_address), creator:created_by(full_name), reviewer:reviewed_by(full_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      setLetter(data);
    } catch (err: any) {
      alert('Görüş yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Gorus_${letter?.client?.name || ''}_${letter?.letter_date || ''}`.replace(/\s+/g, '_');
    window.print();
    setTimeout(() => { document.title = originalTitle; }, 1000);
  };

  const handleAnswer = async (approve: boolean) => {
    const note = window.prompt(approve ? 'Onay notu (opsiyonel):' : 'Red gerekçesi (opsiyonel):', '');
    if (note === null) return;
    if (!window.confirm(approve ? 'Bu görüşü onaylamak istediğinize emin misiniz?' : 'Bu görüşü reddetmek istediğinize emin misiniz?')) return;

    setAnswering(true);
    try {
      const { error } = await supabase
        .from('opinion_letters')
        .update({
          status: approve ? 'approved' : 'rejected',
          reviewed_by: userId,
          reviewed_at: new Date().toISOString(),
          review_notes: note.trim() || null,
          // Reddedilen görüşün Sayı numarası boşa çıkar; bir sonraki yeni görüş bu numarayı devralabilir.
          sequence_no: approve ? letter.sequence_no : null,
        })
        .eq('id', id);
      if (error) throw error;
      alert(approve ? 'Görüş onaylandı.' : 'Görüş reddedildi.');
      await fetchLetter();
    } catch (err: any) {
      alert('İşlem sırasında hata: ' + err.message);
    } finally {
      setAnswering(false);
    }
  };

  if (loading) return <div className="p-8 text-center">Görüş yükleniyor...</div>;
  if (!letter) return <div className="p-8 text-center">Görüş bulunamadı.</div>;

  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'premium_individual';
  const statusLabel = letter.status === 'approved' ? 'Onaylandı' : letter.status === 'rejected' ? 'Reddedildi' : 'Onay Bekliyor';
  const statusColor = letter.status === 'approved'
    ? 'bg-green-50 text-green-700 border-green-200'
    : letter.status === 'rejected'
    ? 'bg-red-50 text-red-700 border-red-200'
    : 'bg-amber-50 text-amber-700 border-amber-200';

  const letterYear = new Date(letter.letter_date).getFullYear();
  const sayiNo = letter.status === 'rejected'
    ? '—'
    : letter.sequence_no
    ? `${letterYear}-${String(letter.sequence_no).padStart(2, '0')}`
    : String(letterYear);

  const handleDownloadWord = async () => {
    const dateLabel = new Date(letter.letter_date).toLocaleDateString('tr-TR');
    const BLUE_700 = '1D4ED8';
    const BLUE_200 = 'BFDBFE';
    const BLUE_100 = 'DBEAFE';
    const GRAY_900 = '111827';
    const GRAY_800 = '1F2937';

    const doc = new Document({
      sections: [{
        children: [
          // Üstteki renkli çerçeve (h-3 bg-gradient-to-r from-blue-700 via-sky-500 to-blue-700)
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 24, color: BLUE_700 } },
            spacing: { after: 200 },
            children: [],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'Sayı: ', bold: true, color: BLUE_700 }),
              new TextRun({ text: sayiNo, color: GRAY_800 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { after: 100 },
            children: [
              new TextRun({ text: 'Tarih: ', bold: true, color: BLUE_700 }),
              new TextRun({ text: dateLabel, color: GRAY_800 }),
            ],
          }),
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: BLUE_100 } },
            spacing: { after: 300 },
            children: [
              new TextRun({ text: 'Konu: ', bold: true, color: BLUE_700 }),
              new TextRun({ text: letter.subject, color: GRAY_800 }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [new TextRun({ text: letter.institution_name?.toUpperCase() || '', bold: true, color: GRAY_900 })],
          }),
          ...String(letter.content || '').split('\n').map((line: string) =>
            new Paragraph({
              alignment: AlignmentType.JUSTIFIED,
              children: [new TextRun({ text: line, color: GRAY_900 })],
            })
          ),
          new Paragraph({ text: '' }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: (letter.client?.name || '').toUpperCase(), bold: true, color: GRAY_800 })],
          }),
          new Paragraph({ text: '' }),
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { top: { style: BorderStyle.SINGLE, size: 12, color: BLUE_200 } },
            spacing: { before: 200 },
            children: [new TextRun({ text: 'İMZA / KAŞE', bold: true, color: BLUE_700 })],
          }),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    const filename = `Gorus_${(letter?.client?.name || '').replace(/\s+/g, '_')}_${letter?.letter_date || ''}.docx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col items-center w-full space-y-6">
      <div className="print-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 w-full" style={{ maxWidth: '210mm' }}>
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-slate-900 dark:text-gray-300 rounded-lg transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
              Görüş Yazısı
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border uppercase ${statusColor}`}>{statusLabel}</span>
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {letter.client?.name} — {new Date(letter.letter_date).toLocaleDateString('tr-TR')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg transition font-bold text-sm"
          >
            <Printer size={16} /> Yazdır / PDF İndir
          </button>
          <button
            onClick={handleDownloadWord}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-bold text-sm"
          >
            <FileDown size={16} /> Word İndir
          </button>
          {isManager && letter.status !== 'approved' && (
            <button
              onClick={() => handleAnswer(true)}
              disabled={answering}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg transition font-bold text-sm"
            >
              <Check size={16} /> Onayla
            </button>
          )}
          {isManager && letter.status !== 'rejected' && (
            <button
              onClick={() => handleAnswer(false)}
              disabled={answering}
              className="flex items-center gap-2 px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 rounded-lg transition font-bold text-sm"
            >
              <XCircle size={16} /> Reddet
            </button>
          )}
        </div>
      </div>

      {letter.status === 'rejected' && letter.review_notes && (
        <div className="print-hidden bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-sm text-rose-800 w-full" style={{ maxWidth: '210mm' }}>
          <b>Red Gerekçesi:</b> {letter.review_notes}
        </div>
      )}
      {letter.status === 'approved' && letter.review_notes && (
        <div className="print-hidden bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-sm text-emerald-800 w-full" style={{ maxWidth: '210mm' }}>
          <b>Onay Notu:</b> {letter.review_notes}
        </div>
      )}

      {/* A4 Yazdırılabilir Görüş Yazısı */}
      <div
        className="print-content bg-white shadow-2xl print:shadow-none flex flex-col"
        style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Times New Roman', Georgia, serif" }}
      >
        {/* Renkli çerçeve */}
        <div className="h-3 bg-gradient-to-r from-blue-700 via-sky-500 to-blue-700" />
        <div className="flex-1 flex flex-col border-x-4 border-b-4 border-blue-100" style={{ padding: '14mm 16mm' }}>

          {/* Ortalanacak blok: antet + başlık + metin + imza, sayfada dikey ortalı */}
          <div className="flex-1 flex flex-col justify-center">

            {/* Antet satır 1: sadece logo, sağda */}
            <div className="flex justify-end mb-1.5">
              <div className="w-28 h-14 flex items-center justify-end">
                {letter.client?.logo_url ? (
                  <img src={letter.client.logo_url} alt="Firma Logo" className="max-h-full max-w-full object-contain" />
                ) : null}
              </div>
            </div>

            {/* Antet satır 2: Sayı solda, Tarih sağda (logonun tam altında) - aynı hizada */}
            <div className="flex justify-between items-center mb-1.5">
              <p className="text-[11px] text-gray-600"><span className="font-bold text-blue-700">Sayı:</span> {sayiNo}</p>
              <p className="text-[11px] text-gray-600"><span className="font-bold text-blue-700">Tarih:</span> {new Date(letter.letter_date).toLocaleDateString('tr-TR')}</p>
            </div>

            {/* Antet satır 3: Konu, Sayı'nın hemen altında solda */}
            <div className="mb-8 pb-5 border-b-2 border-blue-100">
              <p className="text-[11px] text-gray-600"><span className="font-bold text-blue-700">Konu:</span> {letter.subject}</p>
            </div>

            {/* Başlık - ortada */}
            <div className="text-center mb-10">
              <h1 className="text-xl font-bold uppercase tracking-wide text-gray-900 leading-relaxed">
                {letter.institution_name}
              </h1>
            </div>

            {/* Açıklama / görüş metni - yaslanmış (justify) */}
            <div className="text-[13px] text-gray-900 leading-[2.1] whitespace-pre-wrap text-justify">
              {letter.content}
            </div>

            {/* İmza alanı - metnin bittiği yerin hemen sağ altında */}
            <div className="mt-10 flex justify-end">
              <div className="text-center text-[12px] font-bold text-gray-800 min-w-[55mm]">
                <p className="uppercase">{letter.client?.name}</p>
                <div className="h-16" />
                <p className="border-t-2 border-blue-200 pt-1.5 text-[10px] font-semibold text-blue-700 tracking-wide">İMZA / KAŞE</p>
              </div>
            </div>
          </div>

          {/* Alt bilgi (footer): solda logo, yanında ünvan / e-posta / vergi no - Hizmet Verilen İşletmeler kaydından */}
          <div className="pt-5 border-t border-blue-100 flex items-center gap-3">
            <div className="w-14 h-9 shrink-0 flex items-center justify-start">
              {letter.client?.logo_url ? (
                <img src={letter.client.logo_url} alt="Firma Logo" className="max-h-full max-w-full object-contain" />
              ) : null}
            </div>
            <div className="text-[9px] text-gray-500 leading-relaxed text-left">
              <p className="font-bold text-gray-700 uppercase">{letter.client?.name}</p>
              {letter.client?.kep_address && <p>{letter.client.kep_address}</p>}
              {letter.client?.tax_no && <p>Vergi No: {letter.client.tax_no}</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="print-hidden text-xs text-gray-400 text-center">
        Hazırlayan: {letter.creator?.full_name || 'Bilinmeyen'}
        {letter.reviewer?.full_name && <> · İnceleyen: {letter.reviewer.full_name}</>}
      </div>
    </div>
  );
}
