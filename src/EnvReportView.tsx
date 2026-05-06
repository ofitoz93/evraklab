import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Printer, Link as LinkIcon, Download, CheckCircle, ArrowLeft, ExternalLink } from 'lucide-react';

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
    if (!value || value.trim() === '') return null;
    return (
      <div className="mb-4 break-inside-avoid">
        <h4 className="font-bold text-xs text-blue-800 border-b border-blue-100 mb-1 uppercase tracking-tight">{title}</h4>
        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{value}</p>
      </div>
    );
  };

  const renderSubHeader = (title: string) => (
     <h3 className="font-extrabold text-sm mt-6 mb-3 bg-gray-100 p-2 border-l-4 border-blue-600 uppercase tracking-wider">{title}</h3>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Print Styles */}
      <style>
        {`
          @media print {
            body { background: white !important; margin: 0 !important; padding: 0 !important; }
            .print-hidden { display: none !important; }
            .print-content { 
              box-shadow: none !important; 
              border: none !important; 
              width: 100% !important; 
              margin: 0 !important; 
              padding: 0 !important;
              min-height: unset !important;
            }
            @page {
              size: A4;
              margin: 15mm;
            }
          }
        `}
      </style>

      {/* Controls */}
      <div className="print-hidden flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/consultant')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="font-bold">Rapor Görünümü</h1>
            <p className="text-xs text-gray-500">{new Date(report.report_date).toLocaleDateString('tr-TR')}</p>
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
            <Download size={18} /> PDF Olarak İndir
          </button>
        </div>
      </div>

      {/* A4 Printable Area */}
      <div className="print-content bg-white shadow-xl mx-auto print:shadow-none print:w-full" style={{ width: '210mm', minHeight: '297mm', padding: '15mm' }}>
        
        {/* HEADER: Logos and Titles */}
        <div className="flex justify-between items-center mb-6 border-b-2 border-gray-800 pb-4">
          <div className="w-24 h-12 flex items-center justify-start">
             {consultantFirm?.consultant_logo_url ? (
               <img src={consultantFirm.consultant_logo_url} alt="Danışman Logo" className="max-h-full object-contain" />
             ) : (
               <div className="text-[10px] font-bold text-gray-400">Danışman Logo</div>
             )}
          </div>
          <div className="text-center flex-1 px-4">
            <h1 className="text-lg font-black uppercase tracking-widest text-gray-900">
              {report.report_type === 'monthly' ? 'AYLIK FAALİYET RAPORU' : 'YILLIK İÇ TETKİK RAPORU'}
            </h1>
            <div className="flex items-center justify-center gap-4 mt-1 text-[10px] font-bold text-gray-600">
               <span>TARİH: {new Date(report.report_date).toLocaleDateString('tr-TR')}</span>
               {fd.visit_morning && <span>SAAT: ÖĞLEDEN ÖNCE</span>}
               {fd.visit_afternoon && <span>SAAT: ÖĞLEDEN SONRA</span>}
            </div>
          </div>
          <div className="w-24 h-12 flex items-center justify-end">
             {report.client?.logo_url ? (
               <img src={report.client?.logo_url} alt="Firma Logo" className="max-h-full object-contain" />
             ) : (
               <div className="text-[10px] font-bold text-gray-400">Firma Logo</div>
             )}
          </div>
        </div>

        {/* CONTENT */}
        <div className="text-gray-900">
          
          {report.report_type === 'monthly' && (
            <>
              {/* İşletme Bilgileri Özet */}
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] border border-gray-200 p-3 bg-gray-50/50 mb-4 rounded-lg">
                <p><strong>UNVAN:</strong> {report.client?.name}</p>
                <p><strong>ADRES:</strong> {report.client?.address}</p>
                <p><strong>DANIŞMAN FİRMA:</strong> {consultantFirm?.name}</p>
                <p><strong>SORUMLU MÜHENDİS:</strong> {report.creator?.full_name}</p>
                <p><strong>FATURA BİLGİSİ:</strong> {fd.A_fatura_bilgisi || '-'}</p>
                <p><strong>HİZMET AYI:</strong> {fd.A_fatura_ayi || '-'}</p>
              </div>

              {renderSubHeader('A - İŞLETME BİLGİLERİ')}
              {renderSection('Faaliyet Konusu', fd.A_faaliyet_konusu)}
              {renderSection('Çevre İzin ve Lisans Kapsamı', fd.A_cevre_izin_yeri)}
              {renderSection('ÇED Yönetmeliği Kapsamı', fd.A_ced_durumu)}
              {renderSection('Çalışan Sayısı', fd.A_personel_sayisi)}
              {renderSection('İşletme Yetkilisi', fd.A_yetkili_ad_soyad)}

              {renderSubHeader('B - FAALİYETİN ÇEVRESEL ETKİLERİ')}
              <div className="pl-2 border-l-2 border-blue-50">
                {renderSection('B.1.1 Su Tüketimi', fd.B11_su_tuketimi)}
                {renderSection('B.1.2 Evsel Atıksu', fd.B12_evsel_atiksu)}
                {renderSection('B.1.3 Endüstriyel Atıksu', fd.B13_end_atiksu)}
                {renderSection('B.1.4 Diğer Atıksular', fd.B14_diger_atiksu)}
                {renderSection('B.1.5 Atıksu Arıtma Tesisi', fd.B15_aritma_tesisi)}
                {renderSection('B.1.6 İç İzleme', fd.B16_ic_izleme)}
                {renderSection('B.1.7 Yeraltı Suyu İzleme', fd.B17_yeralti_suyu)}
                {renderSection('B.1.8 Deniz Suyu Kalitesi', fd.B18_deniz_suyu)}
              </div>

              {renderSubHeader('B.2 - HAVA YÖNETİMİ')}
              {renderSection('B.2.1 Teyit Ölçümü', fd.B21_teyit_olcumu)}
              {renderSection('B.2.2 Sürekli Emisyon Ölçümü', fd.B22_surekli_emisyon)}
              {renderSection('B.2.3.1 Hava Kalitesi Ölçümleri', fd.B231_hava_kalitesi)}
              {renderSection('B.2.3.2 Baca Gazı Ölçümleri', fd.B232_baca_gazi)}
              {renderSection('B.2.4 Kontrolsüz Emisyon Kaynakları', fd.B24_kontrolsuz_emisyon)}

              {renderSubHeader('B.3 - ATIK YÖNETİMİ')}
              {renderSection('B.3.1 Genel Atıklar', fd.B31_genel_atiklar)}
              {renderSection('B.3.2 Proses Atıkları', fd.B32_proses_atiklari)}
              {renderSection('B.3.3 Atık Analizleri', fd.B33_atik_analizleri)}

              {renderSubHeader('B.4 - B.7 DİĞER YÖNETİMLER')}
              {renderSection('B.4 Gürültü Yönetimi', fd.B4_gurultu)}
              {renderSection('B.5 Toprak Kirliliği', fd.B5_toprak)}
              {renderSection('B.6 Kimyasallar Yönetimi', fd.B6_kimyasallar)}
              {renderSection('B.7 BEKRA / Endüstriyel Kazalar', fd.B7_bekra)}

              {renderSubHeader('B.8 - KIYI TESİSLERİ')}
              {renderSection('B.8.1 Deniz Kirliliği ile Mücadele', fd.B81_deniz_kirliligi)}
              {renderSection('B.8.2 Atık Kabul Tesisi', fd.B82_atik_kabul)}

              {renderSubHeader('B.9 - MADEN İŞLETMELERİ')}
              {renderSection('B.9.1 Koordinatlar', fd.B91_koordinatlar)}
              {renderSection('B.9.2 Patlatma Bilgileri', fd.B92_patlatma)}

              {renderSubHeader('C - İZİN VE LİSANS İŞLEMLERİ')}
              {renderSection('C.1 GFB İşlemleri', fd.C1_gfb_islemleri)}
              {renderSection('C.2 Çevre İzni / Lisansı İşlemleri', fd.C2_izin_islemleri)}

              {renderSubHeader('Ç - KAZA, ARIZA, BAKIM')}
              {renderSection('Ç.1 Kaza ve Kaçaklar', fd.C1_kaza_kacaklar)}
              {renderSection('Ç.2 Arıza, Bakım ve Onarım', fd.C2_ariza_bakim)}

              {renderSubHeader('D - ŞİKAYETLER')}
              {renderSection('D.1 İşletmeye Gelen Şikayetler', fd.D1_isletme_sikayet)}
              {renderSection('D.2 Bakanlığa İletilen Şikayetler', fd.D2_bakanlik_sikayet)}

              {renderSubHeader('E - EĞİTİMLER')}
              {renderSection('E.1 Eğitimler', fd.E1_egitimler)}
              {renderSection('E.2 Bilinçlendirme Çalışmaları', fd.E2_bilinclendirme)}

              {renderSubHeader('F - SONUÇ VE ÖNERİLER')}
              {renderSection('Sonuç ve Değerlendirme', fd.F_sonuc_oneriler)}

              {fd.attachment_urls && fd.attachment_urls.length > 0 && (
                <>
                  {renderSubHeader('G - EKLER')}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {fd.attachment_urls.map((url: string, idx: number) => (
                      <div key={idx} className="border p-1 rounded bg-gray-50 flex items-center justify-center aspect-square overflow-hidden">
                        <img src={url} alt="Ek" className="max-h-full max-w-full object-contain" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {report.report_type === 'yearly' && (
            <div className="space-y-8">
              <div className="text-center mb-10">
                <h2 className="text-2xl font-black mb-1">İÇ TETKİK RAPORU</h2>
                <p className="text-sm font-bold text-gray-500 uppercase">{new Date(report.report_date).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</p>
              </div>

              {/* 1 - İŞLETME BİLGİLERİ TABLE */}
              <h3 className="font-extrabold text-sm mb-3 bg-gray-800 text-white p-2 uppercase tracking-wider">1 - İŞLETME BİLGİLERİ</h3>
              <div className="border-2 border-gray-800 text-[10px]">
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">UNVAN</div>
                  <div className="p-2 col-span-3">{report.client?.name}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">ADRES</div>
                  <div className="p-2 col-span-3">{report.client?.address}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">VERGİ DAİRESİ / NO</div>
                  <div className="p-2 border-r border-gray-800">{fd.Y1_vergi_bilgisi || '-'}</div>
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">ÇKN</div>
                  <div className="p-2">{fd.Y1_ckn || '-'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">ALAN (m²)</div>
                  <div className="p-2 col-span-3">Açık: {fd.Y1_alan_acik || '0'} | Kapalı: {fd.Y1_alan_kapali || '0'} | Toplam: {fd.Y1_alan_toplam || '0'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">KOORDİNAT (UTM)</div>
                  <div className="p-2 border-r border-gray-800">{fd.Y1_koordinat || '-'}</div>
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">KURULU YER</div>
                  <div className="p-2">{fd.Y1_kurulus_yeri || '-'}</div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">PERSONEL</div>
                  <div className="p-2 col-span-3">
                    İdari: {fd.Y1_p_idari} | Müh: {fd.Y1_p_muh} | Tek: {fd.Y1_p_tek} | Usta: {fd.Y1_p_usta} | İşçi: {fd.Y1_p_isci} | Top: {fd.Y1_p_toplam}
                  </div>
                </div>
                <div className="grid grid-cols-4 border-b border-gray-800">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">NACE BİLGİSİ</div>
                  <div className="p-2 col-span-3">{fd.Y1_nace_kod} - {fd.Y1_nace_adi}</div>
                </div>
                <div className="grid grid-cols-4">
                  <div className="p-2 font-bold bg-gray-50 border-r border-gray-800">BELGELER</div>
                  <div className="p-2 col-span-3">
                    ÇED: {fd.Y1_kap_ced} | İzin: {fd.Y1_kap_izin} | Kapasite: {fd.Y1_kap_rapor}
                  </div>
                </div>
              </div>

              {renderSubHeader('2 - İŞLETME HAKKINDA GENEL BİLGİLER')}
              {renderSection('İşletme Özeti', fd.Y2_genel_bilgiler)}
              {renderSection('Faaliyet Sahibi Değişikliği', fd.Y2_faaliyet_sahibi)}

              {renderSubHeader('3 - ÇED YÖNETMELİĞİNE GÖRE DURUMU')}
              {renderSection('Değerlendirme', fd.Y3_ced_durumu)}

              {renderSubHeader('4 - ÇEVRE İZİN VE LİSANS YÖNETMELİĞİ (ÇİLY)')}
              <div className="grid grid-cols-3 gap-4 mb-4 text-xs font-bold bg-gray-50 p-3 border">
                <div>Ek Liste: {fd.Y4_ek_liste}</div>
                <div>Bölüm No: {fd.Y4_bolum_no}</div>
                <div>Faaliyet Adı: {fd.Y4_faaliyet_adi}</div>
              </div>
              {renderSection('İzin Konusu', fd.Y4_izin_konulari)}
              {renderSection('GFB İşlemleri', fd.Y4_gfb_islemleri)}
              {renderSection('İzin/Lisans İşlemleri', fd.Y4_izin_lisans_islemleri)}

              {renderSubHeader('5 - İŞ AKIM ŞEMASI VE PROSES ÖZETİ')}
              {renderSection('Proses Özeti', fd.Y5_proses_ozeti)}

              {renderSubHeader('6 - ÇEVRESEL ETKİLER VE ÖNLEMLER')}
              <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                {renderSection('6.1 Su ve Atıksu Yönetimi', fd.Y611_su_tuketimi || fd.Y612_evsel_atiksu || fd.Y613_end_atiksu ? 'Detaylı analiz yapıldı.' : '')}
                {renderSection('6.1.1 Su Tüketimi', fd.Y611_su_tuketimi)}
                {renderSection('6.1.2 Evsel Atıksu', fd.Y612_evsel_atiksu)}
                {renderSection('6.1.3 Endüstriyel Atıksu', fd.Y613_end_atiksu)}
                {renderSection('6.1.6 Arıtma Tesisleri', fd.Y616_aritma_bilgi)}
                {renderSection('6.1.7 İç İzleme', fd.Y617_ic_izleme)}
                
                {renderSection('6.2 Hava Yönetimi', fd.Y621_emisyon_kaynaklari)}
                {renderSection('6.2.3 Teyit Ölçümü', fd.Y623_teyit_olcumu)}
                {renderSection('6.2.4 Sürekli Emisyon Ölçümü', fd.Y624_surekli_emisyon)}

                {renderSection('6.3 Atık Yönetimi', fd.Y631_genel_atiklar)}
                {renderSection('6.3.2 Proses Atıkları', fd.Y632_proses_atiklari)}
                {renderSection('6.3.4 Atık Yönetim Planı', fd.Y634_atik_plani)}
                {renderSection('6.3.5 Atık Beyanları', fd.Y635_atik_beyanlari)}

                {renderSection('6.4 Gürültü Yönetimi', fd.Y64_gurultu)}
                {renderSection('6.5 Toprak Kirliliği', fd.Y65_toprak)}
                {renderSection('6.6 Kimyasallar Yönetimi', fd.Y66_kimyasallar)}
                {renderSection('6.7 BEKRA', fd.Y67_bekra)}
                {renderSection('6.10 Çevre Denetimi', fd.Y610_denetim)}
                {renderSection('6.11 Yatırımlar', fd.Y611_yatirimlar)}
              </div>

              {renderSubHeader('7 - 8 - 9 BÖLÜMLER')}
              {renderSection('7. Kaza ve Kaçaklar', fd.Y7_kaza_ariza)}
              {renderSection('8. Şikayetler', fd.Y8_sikayetler)}
              {renderSection('9. Eğitimler', fd.Y9_egitimler)}

              {renderSubHeader('10 - SONUÇ VE ÖNERİLER')}
              <div className="bg-green-50 p-4 border border-green-200 rounded-lg">
                {renderSection('Sonuç', fd.Y10_sonuc_oneriler)}
              </div>

              {fd.attachment_urls && fd.attachment_urls.length > 0 && (
                <>
                  {renderSubHeader('11 - EKLER')}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {fd.attachment_urls.map((url: string, idx: number) => (
                      <div key={idx} className="border p-2 rounded bg-gray-50 shadow-sm aspect-video overflow-hidden flex items-center justify-center">
                        <img src={url} alt={`Ek ${idx+1}`} className="max-h-full max-w-full object-contain" />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* SIGNATURE BLOCK */}
        <div className="mt-16 pt-8 border-t-2 border-gray-800 grid grid-cols-2 md:grid-cols-4 gap-4 text-center" style={{ pageBreakInside: 'avoid' }}>
           <div>
             <h4 className="font-bold text-[9px] mb-12 uppercase">İşletme Yetkilisi</h4>
             <div className="flex flex-col items-center">
               <p className="border-t border-gray-400 pt-1 font-bold text-[10px] w-full">{report.client?.name?.substring(0, 20)}...</p>
               <p className="text-[8px] text-gray-500">Kaşe / İmza</p>
             </div>
           </div>
           <div>
             <h4 className="font-bold text-[9px] mb-12 uppercase">Çevre Mühendisi</h4>
             <div className="flex flex-col items-center">
               <p className="border-t border-gray-400 pt-1 font-bold text-[10px] w-full">{report.creator?.full_name}</p>
               {report.engineer_signature && (
                  <div className="mt-1 text-[7px] text-green-700 font-bold bg-green-50 px-1 py-0.5 rounded border border-green-100 flex items-center gap-0.5">
                    <CheckCircle size={8} /> İmzalandı
                  </div>
               )}
             </div>
           </div>
           <div>
             <h4 className="font-bold text-[9px] mb-12 uppercase">Çevre Mühendisi 2</h4>
             <div className="flex flex-col items-center">
               <p className="border-t border-gray-400 pt-1 font-bold text-[10px] w-full">-</p>
               <p className="text-[8px] text-gray-500">Kaşe / İmza</p>
             </div>
           </div>
           <div>
             <h4 className="font-bold text-[9px] mb-12 uppercase">Koordinatör</h4>
             <div className="flex flex-col items-center">
               <p className="border-t border-gray-400 pt-1 font-bold text-[10px] w-full">Koordinatör</p>
               <p className="text-[8px] text-gray-500">Kaşe / İmza</p>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
