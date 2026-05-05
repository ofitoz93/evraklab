import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  Save,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  RefreshCw,
  UploadCloud,
  CheckCircle,
} from 'lucide-react';

interface Client {
  id: string;
  name: string;
  address: string;
  tax_no: string;
  phone: string;
}

export default function EnvReportForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Form State
  const [clientId, setClientId] = useState('');
  const [reportType, setReportType] = useState<'monthly' | 'yearly'>('monthly');
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0]);
  const [isManualUpload, setIsManualUpload] = useState(false);
  const [fileUrl, setFileUrl] = useState('');

  // Kompleks JSON verisi
  const [formData, setFormData] = useState<any>({});
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name, role, organization_id')
      .eq('id', session.user.id)
      .single();

    if (profile) {
      setUserProfile(profile);

      // Müşterileri çek
      let query = supabase.from('consultant_clients').select('*');
      if (profile.role === 'corporate_staff') {
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', session.user.id);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) query = query.in('id', cIds);
        else query = query.eq('id', 'uuid-no-match'); // Boş dönsün
      } else {
        query = query.eq('consultant_company_id', profile.organization_id);
      }

      const { data: clientsData } = await query;
      if (clientsData) setClients(clientsData);
    }
  };

  const handleLoadPrevious = async () => {
    if (!clientId) {
      alert('Lütfen önce bir işletme seçin.');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('env_reports')
        .select('form_data')
        .eq('client_id', clientId)
        .eq('report_type', reportType)
        .eq('is_manual_upload', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) throw error;
      if (data?.form_data) {
        setFormData(data.form_data);
        alert('Önceki veriler başarıyla yüklendi!');
      } else {
        alert('Bu işletme ve rapor türü için önceki bir kayıt bulunamadı.');
      }
    } catch (err: any) {
      if (err.code === 'PGRST116') {
         alert('Bu işletme ve rapor türü için önceki bir kayıt bulunamadı.');
      } else {
         console.error('Veri çekme hatası:', err);
      }
    }
  };

  const handleUpdateField = (path: string, value: any) => {
    setFormData((prev: any) => {
      const newData = { ...prev };
      // Basit 1 seviyeli path kullanıyoruz şimdilik (örn: 'A_unvan')
      newData[path] = value;
      return newData;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `report_${Math.random()}.${fileExt}`;
      const filePath = `reports/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      setFileUrl(data.publicUrl);
    } catch (err: any) {
      alert('Dosya yüklenirken hata: ' + err.message + '\nLütfen "client_assets" bucket\'ının mevcut olduğundan emin olun.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!clientId) {
      alert('Lütfen bir işletme seçin!');
      return;
    }
    setLoading(true);
    try {
      // Geçerlilik tarihi hesapla
      const dateObj = new Date(reportDate);
      if (reportType === 'monthly') {
        dateObj.setMonth(dateObj.getMonth() + 1);
      } else {
        dateObj.setFullYear(dateObj.getFullYear() + 1);
      }
      const expiresAt = dateObj.toISOString().split('T')[0];

      const { data, error } = await supabase.from('env_reports').insert([
        {
          client_id: clientId,
          consultant_company_id: userProfile?.organization_id,
          creator_id: userProfile?.id,
          report_type: reportType,
          report_date: reportDate,
          expires_at: expiresAt,
          is_manual_upload: isManualUpload,
          file_url: fileUrl,
          form_data: formData,
          status: 'completed',
        },
      ]).select('id').single();

      if (error) throw error;
      alert('Rapor başarıyla kaydedildi!');
      navigate(`/consultant/reports/${data.id}`);
    } catch (err: any) {
      alert('Kaydetme hatası: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // ----- RENDER YARDIMCILARI -----
  const renderTextInput = (label: string, fieldKey: string, placeholder: string = '', isTextArea = false) => (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      {isTextArea ? (
        <textarea
          value={formData[fieldKey] || ''}
          onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg p-3 min-h-[100px] dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      ) : (
        <input
          type="text"
          value={formData[fieldKey] || ''}
          onChange={(e) => handleUpdateField(fieldKey, e.target.value)}
          placeholder={placeholder}
          className="w-full border rounded-lg p-3 dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      )}
    </div>
  );

  // --- AYLIK RAPOR ADIMLARI ---
  const renderMonthlyStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">A. İŞLETME BİLGİLERİ</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderTextInput('Faaliyet Konusu', 'A_faaliyet_konusu')}
        {renderTextInput('Çevre İzin ve Lisans Yönetmeliği Kapsamındaki Yeri', 'A_cevre_izin_yeri', 'Ek listelerindeki kapsamı, bölüm no vb.')}
        {renderTextInput('ÇED Yönetmeliği Kapsamındaki Değerlendirmesi', 'A_ced_durumu')}
        {renderTextInput('Çalışan Personel Sayısı', 'A_personel_sayisi')}
        {renderTextInput('İşletme Yetkilisi Ad Soyad', 'A_yetkili_ad_soyad')}
        {renderTextInput('Son Ay Yapılan Ziyarete Ait Fatura Tarihi ve Numarası', 'A_fatura_bilgisi')}
        {renderTextInput('Faturaya ait Hizmet Verilen Ay', 'A_fatura_ayi', 'Örn: Ocak 2024')}
      </div>

      <h3 className="text-xl font-bold border-b pb-2 mt-8">B. FAALİYETİN ÇEVRESEL ETKİLERİ VE ALINAN ÖNLEMLER</h3>
      <h4 className="font-bold text-lg text-blue-600 mt-4">B.1 - SU VE ATIKSU YÖNETİMİ</h4>
      {renderTextInput('B.1.1 SU TÜKETİMİ', 'B11_su_tuketimi', 'Su tüketim miktarı (kaynak bilgisiyle birlikte)', true)}
      {renderTextInput('B.1.2 EVSEL ATIKSU', 'B12_evsel_atiksu', 'Miktar, kaynaklar, kirlilik yükleri, vidanjör vb.', true)}
      {renderTextInput('B.1.3 ENDÜSTRİYEL ATIKSU', 'B13_end_atiksu', 'Miktar, kaynaklar, arıtma tesisi durumu vb.', true)}
      {renderTextInput('B.1.4 DİĞER ATIKSULAR', 'B14_diger_atiksu', 'Soğutma suyu, blöf suyu vb.', true)}
      {renderTextInput('B.1.5 ATIKSU ARITMA TESİSİ HAKKINDA BİLGİ', 'B15_aritma_tesisi', 'Deşarj edilen su miktarı, çamur türü vb.', true)}
      {renderTextInput('B.1.6 İÇ İZLEME', 'B16_ic_izleme', 'Numune alma periyotları ve sonuçları', true)}
      {renderTextInput('B.1.7 YERALTI SUYU İZLEME', 'B17_yeralti_suyu', 'Gözlem kuyusu bilgisi, sonuçlar', true)}
      {renderTextInput('B.1.8 DENİZ SUYU KALİTESİ', 'B18_deniz_suyu', 'Numune alınan nokta ve sonuçlar', true)}
    </div>
  );

  const renderMonthlyStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h4 className="font-bold text-lg text-blue-600 mt-4">B.2 - HAVA YÖNETİMİ</h4>
      {renderTextInput('B.2.1 TEYİT ÖLÇÜMÜ', 'B21_teyit_olcumu', 'Teyit ölçüm rapor tarihleri vb.', true)}
      {renderTextInput('B.2.2 SÜREKLİ EMİSYON ÖLÇÜMÜ', 'B22_surekli_emisyon', 'SEÖS verileri, KGS3 testleri vb.', true)}
      {renderTextInput('B.2.3 İÇ İZLEME (Hava Kalitesi ve Baca Gazı)', 'B23_ic_izleme', 'Hava kalitesi ölçüm istasyonu verileri', true)}
      {renderTextInput('B.2.4 KONTROLSÜZ EMİSYON KAYNAKLARI', 'B24_kontrolsuz_emisyon', 'Alınacak önlemler vb.', true)}

      <h4 className="font-bold text-lg text-blue-600 mt-4">B.3 - ATIK YÖNETİMİ</h4>
      {renderTextInput('B.3.1 GENEL ATIKLAR', 'B31_genel_atiklar', 'Evsel, ambalaj vb. miktarlar, geçici depolama', true)}
      {renderTextInput('B.3.2 PROSES ATIKLARI', 'B32_proses_atiklari', 'Tehlikeli atık, atık yağ vb. kodlar, miktarlar', true)}
      {renderTextInput('B.3.3 ATIK ANALİZLERİ', 'B33_atik_analizleri', 'Analizler ve sonuçları', true)}

      <h4 className="font-bold text-lg text-blue-600 mt-4">DİĞER YÖNETİMLER</h4>
      {renderTextInput('B.4 GÜRÜLTÜ YÖNETİMİ', 'B4_gurultu', 'Ölçüm / arka plan ölçümü', true)}
      {renderTextInput('B.5 TOPRAK KİRLİLİĞİ', 'B5_toprak', 'Toprak kirliliği tespitleri', true)}
      {renderTextInput('B.6 KİMYASALLAR YÖNETİMİ', 'B6_kimyasallar', 'Güvenlik bilgi formları, depolama şartları', true)}
      {renderTextInput('B.7 BEKRA', 'B7_bekra', 'Büyük endüstriyel kazaların kontrolü', true)}
    </div>
  );

  const renderMonthlyStep4 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">C - DİĞER İŞLEM VE DEĞERLENDİRMELER</h3>
      {renderTextInput('C. GFB / ÇEVRE İZNİ İŞLEMLERİ', 'C_izin_islemleri', 'Dönem içinde yapılan işlemler', true)}
      {renderTextInput('Ç. KAZA, KAÇAK, ARIZA, BAKIM VE ONARIM', 'C_kaza_ariza', 'Kaza/kaçaklara ilişkin bilgi, alınan önlemler', true)}
      {renderTextInput('D. ŞİKAYETLER', 'D_sikayetler', 'İşletmeye ve Bakanlığa iletilen şikayetler', true)}
      {renderTextInput('E. EĞİTİMLER', 'E_egitimler', 'Eğitimler ve bilinçlendirme çalışmaları', true)}
      
      <h3 className="text-xl font-bold border-b pb-2 mt-8 text-green-600">F. SONUÇ VE ÖNERİLER</h3>
      {renderTextInput('Sonuç ve Öneriler', 'F_sonuc_oneriler', 'Olumsuzluk, eksiklik ve giderilmesine yönelik öneriler', true)}

      <h3 className="text-xl font-bold border-b pb-2 mt-8">G. EKLER</h3>
      {renderTextInput('Ek Belgeler ve Bağlantılar', 'G_ekler', 'MOTAT ekran görüntüleri, analiz raporları linkleri vb.', true)}
    </div>
  );

  // --- YILLIK RAPOR ADIMLARI ---
  // (Not: Yıllık rapor çok uzun olduğu için özet olarak eklendi, gerçek uygulamada daha da detaylandırılabilir)
  const renderYearlyStep2 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">1 - İŞLETME BİLGİLERİ</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {renderTextInput('Beldesi / İlçesi / İli', 'Y1_il_ilce')}
        {renderTextInput('Çevre Kimlik Numarası (ÇKN)', 'Y1_ckn')}
        {renderTextInput('Açık/Kapalı/Toplam Alan (m²)', 'Y1_alan')}
        {renderTextInput('Koordinat Bilgileri (UTM)', 'Y1_koordinat')}
        {renderTextInput('Kurulu Olduğu Yer (OSB vb.)', 'Y1_kurulus_yeri')}
        {renderTextInput('Personel Sayısı (İdari, İşçi Toplam)', 'Y1_personel')}
        {renderTextInput('Çalışma Şekli (Sürekli/Mevsimlik)', 'Y1_calisma_sekli')}
        {renderTextInput('Vardiya Sayısı', 'Y1_vardiya')}
        {renderTextInput('NACE Kodu ve Adı', 'Y1_nace')}
        {renderTextInput('Üretim Konusu', 'Y1_uretim')}
        {renderTextInput('Kapasite Raporu Bilgileri', 'Y1_kapasite', 'Güncel kapasite raporundaki miktarlar', true)}
      </div>
      <h3 className="text-xl font-bold border-b pb-2 mt-6">2 - İŞLETME HAKKINDA GENEL BİLGİLER</h3>
      {renderTextInput('Genel Bilgiler Metni', 'Y2_genel_bilgiler', 'Tapunun ... pafta ... parsel alanında yer almakta olup...', true)}
      <h3 className="text-xl font-bold border-b pb-2 mt-6">3 & 4 - ÇED VE ÇEVRE İZNİ DURUMU</h3>
      {renderTextInput('ÇED Yönetmeliğine Göre Durumu', 'Y3_ced')}
      {renderTextInput('Çevre İzin ve Lisans Yönetmeliğine Göre Durumu', 'Y4_izin')}
      {renderTextInput('İş Akım Şeması ve Proses Özeti', 'Y5_proses', '', true)}
    </div>
  );

  const renderYearlyStep3 = () => (
    <div className="space-y-6 animate-fadeIn">
      <h3 className="text-xl font-bold border-b pb-2">6 - ÇEVRESEL ETKİLER VE ALINAN ÖNLEMLER</h3>
      {renderTextInput('6.1 Su ve Atıksu Yönetimi', 'Y61_su')}
      {renderTextInput('6.2 Hava Yönetimi', 'Y62_hava')}
      {renderTextInput('6.3 Atık Yönetimi', 'Y63_atik', 'Atık kodları, miktarları, atık analizleri vb.', true)}
      {renderTextInput('6.4 Gürültü ve 6.5 Toprak Kirliliği', 'Y64_gurultu_toprak')}
      {renderTextInput('6.6 Kimyasallar ve 6.7 BEKRA', 'Y66_kimyasallar')}
      {renderTextInput('6.11 Çevresel Yatırımlar ve İyileştirmeler', 'Y611_yatirimlar')}
      
      <h3 className="text-xl font-bold border-b pb-2 mt-6">7, 8, 9, 10 - DİĞER BÖLÜMLER</h3>
      {renderTextInput('Kaza, Kaçaklar, Arıza', 'Y7_kaza')}
      {renderTextInput('Şikayetler', 'Y8_sikayetler')}
      {renderTextInput('Eğitimler', 'Y9_egitimler')}
      {renderTextInput('10. SONUÇ VE ÖNERİLER', 'Y10_sonuc', 'Olumsuzluk, eksiklik ve giderilmesine yönelik öneriler', true)}
      {renderTextInput('11. EKLER', 'Y11_ekler', 'Toplantı tutanakları, kapasite raporu, ÇED belgesi yüklemeleri', true)}
    </div>
  );


  const renderSteps = () => {
    if (currentStep === 1) {
      return (
        <div className="space-y-6 animate-fadeIn">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Temel Bilgiler</h2>
          
          <div>
            <label className="block text-sm font-semibold mb-2">Hizmet Verilen İşletme *</label>
            <select
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full border rounded-lg p-3 dark:bg-slate-900 dark:border-slate-700 bg-white"
            >
              <option value="">Seçiniz...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-2">Rapor Türü *</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as 'monthly'|'yearly')}
                className="w-full border rounded-lg p-3 dark:bg-slate-900 dark:border-slate-700 bg-white"
              >
                <option value="monthly">Aylık Değerlendirme Raporu</option>
                <option value="yearly">Yıllık İç Tetkik Raporu</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-2">Rapor (Ziyaret) Tarihi *</label>
              <input
                type="date"
                required
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
                className="w-full border rounded-lg p-3 dark:bg-slate-900 dark:border-slate-700 bg-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg">
             <RefreshCw size={20} />
             <div className="flex-1">
               <p className="font-semibold text-sm">Zaman Kazanmak İster misiniz?</p>
               <p className="text-xs opacity-80">Bu işletme için oluşturulmuş en son rapor verilerini form üzerine otomatik çekebilirsiniz.</p>
             </div>
             <button
               type="button"
               onClick={handleLoadPrevious}
               disabled={!clientId}
               className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold transition disabled:opacity-50"
             >
               Önceki Verileri Çek
             </button>
          </div>

          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-700">
             <label className="flex items-center gap-3 cursor-pointer">
               <input 
                 type="checkbox" 
                 checked={isManualUpload} 
                 onChange={(e) => setIsManualUpload(e.target.checked)} 
                 className="w-5 h-5 text-blue-600 rounded" 
               />
               <span className="font-semibold">Sistem Formu Yerine Manuel Dosya (PDF) Yüklemek İstiyorum</span>
             </label>
             {isManualUpload && (
               <div className="mt-4 p-8 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-slate-900/50">
                 <UploadCloud size={48} className="mb-3 text-blue-500" />
                 
                 {fileUrl ? (
                   <div className="text-center">
                     <p className="text-green-600 font-bold flex items-center gap-2 mb-4">
                       <CheckCircle size={20} /> Dosya Başarıyla Hazırlandı
                     </p>
                     <p className="text-xs text-gray-400 mb-4 truncate max-w-xs">{fileUrl}</p>
                     <button 
                       type="button" 
                       onClick={() => setFileUrl('')}
                       className="text-red-500 text-sm font-bold hover:underline"
                     >
                       Dosyayı Değiştir
                     </button>
                   </div>
                 ) : (
                   <div className="text-center">
                     <p className="font-bold text-gray-700 dark:text-gray-300 mb-2">Rapor Dosyasını Seçin</p>
                     <p className="text-xs text-gray-400 mb-6">PDF, Word veya Görsel dosyaları desteklenir.</p>
                     
                     <label className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold cursor-pointer transition shadow-lg inline-flex items-center gap-2">
                       {uploading ? <RefreshCw size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                       {uploading ? 'Yükleniyor...' : 'Bilgisayardan Dosya Seç'}
                       <input 
                         type="file" 
                         className="hidden" 
                         accept=".pdf,.doc,.docx,image/*" 
                         onChange={handleFileUpload}
                         disabled={uploading}
                       />
                     </label>
                   </div>
                 )}
                 
                 <p className="text-[10px] mt-6 text-gray-400 italic">Not: Manuel dosya yükleme sistem form adımlarını atlar ve direkt bu dosyayı kaydeder.</p>
               </div>
             )}
          </div>
        </div>
      );
    }

    if (reportType === 'monthly') {
      if (currentStep === 2) return renderMonthlyStep2();
      if (currentStep === 3) return renderMonthlyStep3();
      if (currentStep === 4) return renderMonthlyStep4();
    } else {
      if (currentStep === 2) return renderYearlyStep2();
      if (currentStep === 3) return renderYearlyStep3();
    }
  };

  const getMaxSteps = () => {
    if (isManualUpload) return 1;
    return reportType === 'monthly' ? 4 : 3;
  };

  const handleNext = () => {
    if (currentStep === 1 && !clientId) {
      alert("Lütfen işletme seçiniz!");
      return;
    }
    if (currentStep < getMaxSteps()) {
      setCurrentStep(prev => prev + 1);
      window.scrollTo(0, 0);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      {/* Header */}
      <div className="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 sticky top-[72px] z-10">
        <button onClick={() => navigate('/consultant')} className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 rounded-lg">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold">Yeni Rapor Oluştur</h1>
          <p className="text-xs text-gray-500">Adım {currentStep} / {getMaxSteps()}</p>
        </div>
        
        {/* Progress Bar */}
        <div className="flex-1 ml-8">
           <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
             <div 
               className="h-full bg-blue-600 transition-all duration-500" 
               style={{ width: `${(currentStep / getMaxSteps()) * 100}%` }}
             ></div>
           </div>
        </div>
      </div>

      {/* Main Form Container */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-8">
        {renderSteps()}
      </div>

      {/* Footer Navigation */}
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 sticky bottom-4 z-10">
        <button
          onClick={handlePrev}
          disabled={currentStep === 1 || loading}
          className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <ChevronLeft size={18} /> Geri
        </button>

        {currentStep === getMaxSteps() ? (
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg transition disabled:opacity-50"
          >
            {loading ? 'Kaydediliyor...' : 'Raporu Kaydet ve Tamamla'} <Save size={18} />
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2 rounded-lg font-bold shadow-lg transition"
          >
            İleri <ChevronRight size={18} />
          </button>
        )}
      </div>

    </div>
  );
}
