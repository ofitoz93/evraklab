import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { FileText, CheckCircle, ShieldCheck } from 'lucide-react';

export default function ExternalSignPage() {
  const { token } = useParams();
  const [report, setReport] = useState<any>(null);
  const [consultantFirm, setConsultantFirm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  const [signerName, setSignerName] = useState('');
  const [signLoading, setSignLoading] = useState(false);
  const [isSigned, setIsSigned] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [token]);

  const fetchReport = async () => {
    try {
      const { data, error } = await supabase
        .from('env_reports')
        .select('*, client:client_id(name, logo_url, address), creator:creator_id(full_name, organization_id)')
        .eq('signature_link_token', token)
        .single();

      if (error || !data) {
        setReport(null);
        return;
      }

      setReport(data);

      // Check if already signed
      if (data.client_signature) {
        setIsSigned(true);
      }

      let companyId = data?.consultant_company_id;
      if (!companyId && data?.creator?.organization_id) {
        companyId = data.creator.organization_id;
      }

      if (companyId) {
        const { data: compData } = await supabase
          .from('organizations')
          .select('name, consultant_logo_url')
          .eq('id', companyId)
          .single();
        setConsultantFirm(compData);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!signerName.trim()) {
      alert('Lütfen Adınızı ve Soyadınızı girin.');
      return;
    }
    setSignLoading(true);
    try {
      const signatureData = {
        name: signerName,
        signed_at: new Date().toISOString(),
        ip: 'remote', // Normalde server taraflı alınır
      };

      const { error } = await supabase
        .from('env_reports')
        .update({ client_signature: signatureData })
        .eq('id', report.id);

      if (error) throw error;
      
      setIsSigned(true);
      setReport({ ...report, client_signature: signatureData });
      alert('Rapor başarıyla imzalandı!');
    } catch (err: any) {
      alert('İmza atılırken bir hata oluştu: ' + err.message);
    } finally {
      setSignLoading(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50">Yükleniyor...</div>;

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full text-center">
          <ShieldCheck size={48} className="text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Geçersiz Link</h2>
          <p className="text-gray-500 text-sm">Bu imza bağlantısı geçersiz veya süresi dolmuş olabilir. Lütfen danışmanınızla iletişime geçin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Sign Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 text-center relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
          <ShieldCheck size={32} className="text-blue-600 mx-auto mb-2" />
          <h1 className="text-2xl font-extrabold text-gray-900">Güvenli Belge İmza Alanı</h1>
          <p className="text-gray-500 mt-2">
            Aşağıdaki <b>{report.report_type === 'monthly' ? 'Aylık Değerlendirme Raporu' : 'Yıllık İç Tetkik Raporu'}</b> belgesini inceleyip elektronik olarak imzalayabilirsiniz.
          </p>
        </div>

        {/* Report Preview */}
        <div className="bg-white shadow-lg p-8 sm:p-12 rounded-2xl border border-gray-200">
          <div className="flex justify-between items-center mb-8 border-b-2 border-gray-800 pb-4">
             <div className="w-24 h-12 flex items-center justify-start">
               {consultantFirm?.consultant_logo_url && (
                 <img src={consultantFirm.consultant_logo_url} alt="Danışman" className="max-h-full object-contain" />
               )}
             </div>
             <div className="text-center flex-1 px-4">
               <h2 className="text-lg font-bold uppercase">
                 {report.report_type === 'monthly' ? 'AYLIK DEĞERLENDİRME RAPORU' : 'YILLIK İÇ TETKİK RAPORU'}
               </h2>
               <p className="text-sm font-medium mt-1">Tarih: {new Date(report.report_date).toLocaleDateString('tr-TR')}</p>
             </div>
             <div className="w-24 h-12 flex items-center justify-end">
               {report.client?.logo_url && (
                 <img src={report.client?.logo_url} alt="Firma" className="max-h-full object-contain" />
               )}
             </div>
          </div>
          
          <div className="space-y-4 text-sm text-gray-700 bg-gray-50 p-6 rounded-lg border border-gray-200">
            <h3 className="font-bold text-gray-900 border-b pb-2 mb-4">Özet Bilgiler</h3>
            <p><strong>Danışmanlık Firması:</strong> {consultantFirm?.name}</p>
            <p><strong>Hizmet Verilen İşletme:</strong> {report.client?.name}</p>
            <p><strong>İşletme Adresi:</strong> {report.client?.address}</p>
            <p><strong>Hazırlayan Çevre Mühendisi:</strong> {report.creator?.full_name}</p>
          </div>

          <div className="mt-8 text-center text-sm text-gray-500 italic">
            Bu ekran belgenin özetidir. Belgenin tam hali sistemde güvenli olarak saklanmaktadır.
          </div>
        </div>

        {/* Action Area */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 flex flex-col items-center justify-center">
          {isSigned ? (
            <div className="text-center animate-fadeIn">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={40} className="text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Başarıyla İmzalandı</h3>
              <p className="text-gray-500">
                Sayın <b>{report.client_signature?.name}</b>, belgeyi {new Date(report.client_signature?.signed_at).toLocaleString('tr-TR')} tarihinde imzaladınız.
              </p>
              <p className="text-gray-400 text-sm mt-4">Bu sekmeyi kapatabilirsiniz.</p>
            </div>
          ) : (
            <div className="w-full max-w-md text-center">
              <h3 className="text-xl font-bold text-gray-900 mb-4">İşletme Yetkilisi Onayı</h3>
              <p className="text-sm text-gray-500 mb-6">
                Yukarıdaki belgenin tarafınızca incelendiğini ve onaylandığını beyan etmek için adınızı girerek imzalayın.
              </p>
              <input
                type="text"
                placeholder="Adınız Soyadınız"
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                className="w-full border-2 border-gray-300 rounded-xl p-4 text-center font-semibold mb-4 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              />
              <button
                onClick={handleSign}
                disabled={signLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl shadow-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {signLoading ? 'İşleniyor...' : 'Okudum, Onaylıyorum (İmzala)'}
              </button>
              <p className="text-xs text-gray-400 mt-4 flex items-center justify-center gap-1">
                <ShieldCheck size={12} /> 5070 Sayılı Elektronik İmza Kanununa tabi yasal bağlayıcılığı kabul edersiniz.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
