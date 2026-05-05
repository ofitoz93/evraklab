import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Printer, Link as LinkIcon, Download, CheckCircle, ArrowLeft } from 'lucide-react';

export default function EnvReportView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [consultantFirm, setConsultantFirm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [linkCopied, setLinkCopied] = useState(false);

  // Signatures State
  const [isSignMode, setIsSignMode] = useState(false); // E-imza modu aktif mi?

  useEffect(() => {
    fetchReport();
  }, [id]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from('env_reports')
        .select('*, client:client_id(name, logo_url, address, tax_no), creator:creator_id(full_name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      setReport(data);

      if (data?.consultant_company_id) {
        const { data: compData } = await supabase
          .from('organizations')
          .select('name, consultant_logo_url')
          .eq('id', data.consultant_company_id)
          .single();
        setConsultantFirm(compData);
      }
    } catch (err: any) {
      alert('Rapor yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const generateSignLink = async () => {
    try {
      // Şifreli bir token oluştur (basitçe rastgele string ve id)
      let token = report.signature_link_token;
      if (!token) {
        token = btoa(`${report.id}-${Date.now()}`); // Basit bir encode
        await supabase
          .from('env_reports')
          .update({ signature_link_token: token })
          .eq('id', report.id);
        
        setReport({ ...report, signature_link_token: token });
      }

      const link = `${window.location.origin}/sign-report/${token}`;
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Link kopyalanamadı.');
    }
  };

  if (loading) return <div className="p-8 text-center">Rapor Yükleniyor...</div>;
  if (!report) return <div className="p-8 text-center">Rapor bulunamadı.</div>;

  if (report.is_manual_upload) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <button onClick={() => navigate('/consultant')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-4">
          <ArrowLeft size={16} /> Geri Dön
        </button>
        <div className="bg-white p-8 rounded-xl shadow border flex flex-col items-center justify-center min-h-[400px]">
          <Download size={48} className="text-blue-600 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Bu rapor manuel olarak yüklenmiş.</h2>
          <p className="text-gray-500 mb-6">Aşağıdaki butona tıklayarak yüklenen dosyayı görüntüleyebilir veya indirebilirsiniz.</p>
          <a
            href={report.file_url}
            target="_blank"
            rel="noreferrer"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700 transition"
          >
            Dosyayı Görüntüle
          </a>
        </div>
      </div>
    );
  }

  // --- RENDER HELPERS FOR PRINT VIEW ---
  const fd = report.form_data || {};

  const renderSection = (title: string, value: string) => {
    if (!value) return null;
    return (
      <div className="mb-4">
        <h4 className="font-bold text-sm text-gray-800 border-b border-gray-300 mb-1">{title}</h4>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{value}</p>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Controls - (Görünüm Modunda ve Yazdırırken Gizlenecek) */}
      <div className="print:hidden flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/consultant')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold">Rapor Görünümü</h1>
            <p className="text-xs text-gray-500">{new Date(report.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={generateSignLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition text-sm font-medium"
          >
            {linkCopied ? <CheckCircle size={16} /> : <LinkIcon size={16} />}
            {linkCopied ? 'Link Kopyalandı!' : 'Dışarıdan İmza Linki'}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-bold"
          >
            <Printer size={18} /> Yazdır (PDF)
          </button>
        </div>
      </div>

      {/* A4 Printable Area */}
      <div className="bg-white shadow-xl mx-auto print:shadow-none print:w-full" style={{ width: '210mm', minHeight: '297mm', padding: '20mm' }}>
        
        {/* HEADER: Logos and Titles */}
        <div className="flex justify-between items-start mb-8 border-b-2 border-gray-800 pb-4">
          <div className="w-32 h-16 flex items-center justify-start">
             {consultantFirm?.consultant_logo_url ? (
               <img src={consultantFirm.consultant_logo_url} alt="Danışman Logo" className="max-h-full object-contain" />
             ) : (
               <div className="text-sm font-bold text-gray-400">Danışman Logo</div>
             )}
          </div>
          <div className="text-center flex-1 px-4">
            <h1 className="text-xl font-bold uppercase">
              {report.report_type === 'monthly' ? 'AYLIK DEĞERLENDİRME RAPORU' : 'YILLIK İÇ TETKİK RAPORU'}
            </h1>
            <p className="text-sm font-medium mt-1">Tarih: {new Date(report.report_date).toLocaleDateString('tr-TR')}</p>
          </div>
          <div className="w-32 h-16 flex items-center justify-end">
             {report.client?.logo_url ? (
               <img src={report.client?.logo_url} alt="Firma Logo" className="max-h-full object-contain" />
             ) : (
               <div className="text-sm font-bold text-gray-400">Firma Logo</div>
             )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="space-y-6 text-gray-900">
          
          {report.report_type === 'monthly' && (
            <>
              {/* İşletme Bilgileri Özet */}
              <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm border p-4 bg-gray-50 mb-6 rounded">
                <p><strong>Unvan:</strong> {report.client?.name}</p>
                <p><strong>Adres:</strong> {report.client?.address}</p>
                <p><strong>Danışman Firma:</strong> {consultantFirm?.name}</p>
                <p><strong>Çevre Mühendisi:</strong> {report.creator?.full_name}</p>
              </div>

              {renderSection('A. Faaliyet Konusu', fd.A_faaliyet_konusu)}
              {renderSection('A. ÇED Durumu', fd.A_ced_durumu)}
              
              <h3 className="font-bold text-lg mt-6 mb-2 border-b-2 border-black">B. ÇEVRESEL ETKİLER</h3>
              {renderSection('B.1.1 Su Tüketimi', fd.B11_su_tuketimi)}
              {renderSection('B.1.2 Evsel Atıksu', fd.B12_evsel_atiksu)}
              {renderSection('B.1.3 Endüstriyel Atıksu', fd.B13_end_atiksu)}
              {renderSection('B.3.1 Genel Atıklar', fd.B31_genel_atiklar)}
              {renderSection('B.3.2 Proses Atıkları', fd.B32_proses_atiklari)}

              <h3 className="font-bold text-lg mt-6 mb-2 border-b-2 border-black">DİĞER</h3>
              {renderSection('F. Sonuç ve Öneriler', fd.F_sonuc_oneriler)}
            </>
          )}

          {report.report_type === 'yearly' && (
            <>
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold mb-2">{report.client?.name}</h2>
                <h3 className="text-lg">İÇ TETKİK RAPORU</h3>
              </div>
              {renderSection('1. Koordinat ve Alan Bilgileri', fd.Y1_alan + ' ' + (fd.Y1_koordinat || ''))}
              {renderSection('2. Genel Bilgiler', fd.Y2_genel_bilgiler)}
              {renderSection('6. Çevresel Etkiler - Su', fd.Y61_su)}
              {renderSection('6. Çevresel Etkiler - Atık', fd.Y63_atik)}
              {renderSection('10. Sonuç ve Öneriler', fd.Y10_sonuc)}
            </>
          )}

        </div>

        {/* SIGNATURE BLOCK */}
        <div className="mt-20 pt-8 border-t border-gray-400 grid grid-cols-2 gap-8" style={{ pageBreakInside: 'avoid' }}>
           <div className="text-center">
             <h4 className="font-bold mb-16">Çevre Mühendisi / Yetkili</h4>
             <p className="border-t border-gray-400 pt-2 inline-block px-8 w-full max-w-[250px]">
               {report.creator?.full_name}
             </p>
             {report.engineer_signature && (
               <p className="text-xs text-green-600 font-bold mt-1">E-İmzalı: {new Date(report.engineer_signature.signed_at).toLocaleString()}</p>
             )}
           </div>
           <div className="text-center">
             <h4 className="font-bold mb-16">İşletme Sahibi / Sorumlusu</h4>
             <p className="border-t border-gray-400 pt-2 inline-block px-8 w-full max-w-[250px]">
               İmza / Kaşe
             </p>
             {report.client_signature && (
               <p className="text-xs text-green-600 font-bold mt-1">E-İmzalı: {new Date(report.client_signature.signed_at).toLocaleString()}</p>
             )}
           </div>
        </div>

      </div>
    </div>
  );
}
