import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  Building, 
  FileText, 
  Calendar, 
  Trash2, 
  LogOut, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  Download, 
  ExternalLink,
  Shield,
  Activity,
  Layers,
  MapPin,
  ChevronRight
} from 'lucide-react';

export default function ClientPanel() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [clientDetails, setClientDetails] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [actions, setActions] = useState<any[]>([]);
  const [wastes, setWastes] = useState<any[]>([]);
  const [visits, setVisits] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'docs' | 'actions' | 'waste' | 'reports'>('overview');

  // Preview / Detail States
  const [selectedDoc, setSelectedDoc] = useState<any>(null);

  useEffect(() => {
    fetchClientData();
  }, []);

  const fetchClientData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
        return;
      }

      // 1. Get profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profErr || !prof) {
        throw new Error('Profil yüklenemedi.');
      }

      if (prof.role !== 'client' || !prof.client_id) {
        alert('Bu panele sadece müşteri hesapları erişebilir.');
        navigate('/');
        return;
      }

      setProfile(prof);

      // 2. Get client info
      const { data: client, error: clientErr } = await supabase
        .from('consultant_clients')
        .select('*, consultant_company:consultant_company_id(name)')
        .eq('id', prof.client_id)
        .single();

      if (clientErr || !client) {
        throw new Error('Müşteri firma detayları bulunamadı.');
      }
      setClientDetails(client);

      // 3. Get documents matching client name in location_def
      const { data: docs } = await supabase
        .from('documents')
        .select('*, type_def:user_definitions!type_def_id(label), location_def:user_definitions!location_def_id!inner(id, label)')
        .eq('location_def.label', client.name)
        .eq('is_archived', false);
      setDocuments(docs || []);

      // 4. Get actions
      const { data: acts } = await supabase
        .from('compliance_actions')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('due_date', { ascending: true });
      setActions(acts || []);

      // 5. Get waste dispatches
      const { data: wst } = await supabase
        .from('waste_dispatches')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('dispatch_date', { ascending: false });
      setWastes(wst || []);

      // 6. Get visits
      const { data: vs } = await supabase
        .from('visit_schedules')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('visit_date', { ascending: true });
      setVisits(vs || []);

      // 7. Get environmental reports
      const { data: reps } = await supabase
        .from('env_reports')
        .select('*')
        .eq('client_id', prof.client_id)
        .order('created_at', { ascending: false });
      setReports(reps || []);

    } catch (err: any) {
      console.error(err);
      alert('Veriler yüklenirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal-500 mx-auto"></div>
          <p className="text-sm font-semibold tracking-wider text-slate-400">Veriler Güvenle Çekiliyor...</p>
        </div>
      </div>
    );
  }

  // Count helper definitions
  const pendingActions = actions.filter(a => a.status !== 'completed' && a.status !== 'done').length;
  const expiredDocs = documents.filter(d => d.expiry_date && new Date(d.expiry_date) < new Date()).length;

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-100 flex flex-col font-sans">
      
      {/* HEADER NAVBAR */}
      <header className="bg-slate-900/80 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          {clientDetails?.logo_url ? (
            <img src={clientDetails.logo_url} alt="Logo" className="w-10 h-10 rounded-xl border border-slate-700 object-contain bg-slate-950 p-1" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-teal-650 flex items-center justify-center text-white font-bold shadow-lg shadow-teal-500/20">
              <Building size={20} />
            </div>
          )}
          <div>
            <h1 className="font-extrabold text-base md:text-lg tracking-tight text-white flex items-center gap-1.5">
              {clientDetails?.name}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-900 bg-teal-950/40 text-teal-400 uppercase tracking-wider">MÜŞTERİ PANELİ</span>
            </h1>
            <p className="text-[10px] text-slate-450 font-bold">Hizmet Sağlayıcı: <span className="text-teal-400">{clientDetails?.consultant_company?.name || 'Danışmanlık Firması'}</span></p>
          </div>
        </div>

        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/20 transition border border-rose-900/30 hover:border-rose-900/60"
        >
          <LogOut size={14} /> Çıkış Yap
        </button>
      </header>

      {/* DASHBOARD SUMMARY CARDS */}
      <div className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-4 gap-4">
        
        {/* Info Card 1 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:border-slate-700/80 transition">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/10">
            <FileText size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Aktif Evraklar</p>
            <h4 className="text-xl font-black mt-0.5">{documents.length} Adet</h4>
          </div>
        </div>

        {/* Info Card 2 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:border-slate-700/80 transition">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/10">
            <Activity size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Açık Aksiyonlar</p>
            <h4 className="text-xl font-black mt-0.5">{pendingActions} Görev</h4>
          </div>
        </div>

        {/* Info Card 3 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:border-slate-700/80 transition">
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/10">
            <Trash2 size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Atık Gönderimleri</p>
            <h4 className="text-xl font-black mt-0.5">{wastes.length} Sevkiyat</h4>
          </div>
        </div>

        {/* Info Card 4 */}
        <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:border-slate-700/80 transition">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/10">
            <Calendar size={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Planlı Ziyaretler</p>
            <h4 className="text-xl font-black mt-0.5">{visits.length} Ziyaret</h4>
          </div>
        </div>

      </div>

      {/* TABS MENU */}
      <div className="px-6 max-w-7xl mx-auto w-full border-b border-slate-800">
        <div className="flex gap-6 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('overview')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'overview' ? 'border-teal-500 text-teal-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Genel Bakış
          </button>
          <button 
            onClick={() => setActiveTab('docs')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'docs' ? 'border-teal-500 text-teal-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Müşteri Evrakları
          </button>
          <button 
            onClick={() => setActiveTab('actions')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'actions' ? 'border-teal-500 text-teal-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Aksiyon Planları
          </button>
          <button 
            onClick={() => setActiveTab('waste')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'waste' ? 'border-teal-500 text-teal-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Atık Kayıtları
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition ${activeTab === 'reports' ? 'border-teal-500 text-teal-400 font-extrabold' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            Ziyaret & Raporlar
          </button>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <main className="p-6 flex-1 max-w-7xl mx-auto w-full">

        {/* TAB 1: OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Warning if expired docs exist */}
            {expiredDocs > 0 && (
              <div className="bg-rose-950/20 border border-rose-900/40 p-4 rounded-2xl flex items-start gap-3">
                <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={18} />
                <div>
                  <h5 className="text-xs font-extrabold text-rose-400 uppercase tracking-wider">Dikkat Edilmesi Gereken Evraklar Mevcut</h5>
                  <p className="text-xs text-rose-300 mt-1">Süresi geçmiş {expiredDocs} adet belgeniz bulunmaktadır. Lütfen güncel belgelerinizi hazırlayıp çevre şefinize iletin.</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Firm Information */}
              <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800 flex items-center gap-2">
                  <Shield size={16} className="text-teal-500" /> Firma Bilgileri
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500 block mb-1">Firma Ünvanı</span>
                    <span className="font-bold text-slate-200">{clientDetails?.name}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Vergi Numarası</span>
                    <span className="font-bold text-slate-200">{clientDetails?.tax_no || 'Belirtilmedi'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">Telefon</span>
                    <span className="font-bold text-slate-200">{clientDetails?.phone || 'Belirtilmedi'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block mb-1">E-posta</span>
                    <span className="font-bold text-slate-200">{clientDetails?.email || 'Belirtilmedi'}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-slate-500 block mb-1">Adres</span>
                    <span className="font-bold text-slate-200">{clientDetails?.address || 'Belirtilmedi'}</span>
                  </div>
                </div>
              </div>

              {/* Next Visits */}
              <div className="bg-slate-900/30 border border-slate-800 p-6 rounded-2xl space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider pb-3 border-b border-slate-800 flex items-center gap-2">
                  <Calendar size={16} className="text-teal-500" /> Yaklaşan Ziyaretler
                </h3>
                {visits.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Planlanmış yakın bir ziyaret bulunmamaktadır.</p>
                ) : (
                  <div className="space-y-3">
                    {visits.slice(0, 3).map((v) => (
                      <div key={v.id} className="flex justify-between items-center p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl">
                        <div>
                          <span className="text-xs font-bold text-slate-200 block">{v.purpose || 'Çevre Denetimi & Ziyaret'}</span>
                          <span className="text-[10px] text-slate-500">{v.duration_hours || 2} saat planlandı</span>
                        </div>
                        <span className="text-xs font-extrabold text-teal-400 bg-teal-950/40 px-2.5 py-1 rounded-lg border border-teal-900/40">
                          {new Date(v.visit_date).toLocaleDateString('tr-TR')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: CLIENT DOCUMENTS */}
        {activeTab === 'docs' && (
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Sistemde Kayıtlı Belgeleriniz</h3>
              <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 rounded text-slate-400">{documents.length} Adet</span>
            </div>

            {documents.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <FileText size={40} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500 font-medium">Bu firma için yüklenmiş aktif belge bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                      <th className="p-4">Belge Adı</th>
                      <th className="p-4">Belge Türü</th>
                      <th className="p-4">Yayın Tarihi</th>
                      <th className="p-4">Geçerlilik Tarihi</th>
                      <th className="p-4">Boyut</th>
                      <th className="p-4 text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {documents.map((doc) => {
                      const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
                      return (
                        <tr key={doc.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition">
                          <td className="p-4 font-bold text-slate-200">{doc.title}</td>
                          <td className="p-4 text-slate-400">{doc.type_def?.label || 'Belirtilmedi'}</td>
                          <td className="p-4 text-slate-400">{new Date(doc.acquisition_date).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4">
                            {doc.is_indefinite ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">Süresiz</span>
                            ) : (
                              <span className={`font-bold ${isExpired ? 'text-rose-500' : 'text-slate-300'}`}>
                                {new Date(doc.expiry_date).toLocaleDateString('tr-TR')}
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-slate-500">{formatFileSize(doc.file_size)}</td>
                          <td className="p-4 text-right">
                            {doc.file_url ? (
                              <a 
                                href={doc.file_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-teal-450 hover:text-teal-300 font-bold"
                              >
                                Görüntüle <ExternalLink size={12} />
                              </a>
                            ) : (
                              <span className="text-slate-600">Dosya Yok</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: COMPLIANCE ACTIONS */}
        {activeTab === 'actions' && (
          <div className="space-y-4">
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-4 flex justify-between items-center bg-slate-950/20">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Aksiyon Planı ve Denetim Bulguları</h3>
              <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 rounded text-slate-400">{actions.length} Aksiyon</span>
            </div>

            {actions.length === 0 ? (
              <div className="bg-slate-900/20 border border-slate-850 rounded-2xl py-20 text-center space-y-3">
                <CheckCircle size={40} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500 font-medium">Planlanmış veya bekleyen bir aksiyon bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {actions.map((act) => {
                  const isDone = act.status === 'completed' || act.status === 'done';
                  const isOverdue = act.due_date && new Date(act.due_date) < new Date() && !isDone;
                  return (
                    <div 
                      key={act.id} 
                      className={`p-5 rounded-2xl border transition ${isDone ? 'bg-slate-950/20 border-slate-900' : 'bg-slate-900/30 border-slate-800 hover:border-slate-750'}`}
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="text-xs font-bold text-slate-200">{act.finding || 'Denetim Bulgusu'}</span>
                        {isDone ? (
                          <span className="text-[10px] font-black bg-emerald-950/40 text-emerald-450 border border-emerald-900/40 px-2.5 py-0.5 rounded-full uppercase">Tamamlandı</span>
                        ) : isOverdue ? (
                          <span className="text-[10px] font-black bg-rose-950/40 text-rose-450 border border-rose-900/40 px-2.5 py-0.5 rounded-full uppercase animate-pulse">Gecikmiş</span>
                        ) : (
                          <span className="text-[10px] font-black bg-amber-950/40 text-amber-450 border border-amber-900/40 px-2.5 py-0.5 rounded-full uppercase">Bekliyor</span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-2 line-clamp-3"><span className="font-semibold text-slate-400">Düzeltici Faaliyet:</span> {act.corrective_action || 'Belirtilmedi'}</p>

                      <div className="mt-4 pt-3 border-t border-dashed border-slate-800 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        <span>Hedef Tarih</span>
                        <span className={isOverdue ? 'text-rose-500 font-extrabold' : 'text-slate-300'}>
                          {act.due_date ? new Date(act.due_date).toLocaleDateString('tr-TR') : 'Süresiz'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: WASTE DISPATCHES */}
        {activeTab === 'waste' && (
          <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Atık Gönderim Sevkiyat Tarihçesi</h3>
              <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 rounded text-slate-400">{wastes.length} Sevkiyat</span>
            </div>

            {wastes.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <Trash2 size={40} className="text-slate-600 mx-auto" />
                <p className="text-sm text-slate-500 font-medium">Bu firma için kaydedilmiş bir atık gönderimi bulunmamaktadır.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                      <th className="p-4">Atık Türü</th>
                      <th className="p-4">Atık Kodu</th>
                      <th className="p-4">Miktar (kg)</th>
                      <th className="p-4">Taşıyıcı / Bertarafçı</th>
                      <th className="p-4">Sevkiyat Tarihi</th>
                      <th className="p-4">Belge/Motat No</th>
                    </tr>
                  </thead>
                  <tbody>
                    {wastes.map((w) => (
                      <tr key={w.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition text-slate-300">
                        <td className="p-4 font-bold text-slate-200">{w.waste_type || '-'}</td>
                        <td className="p-4 font-mono font-bold text-teal-400">{w.waste_code || '-'}</td>
                        <td className="p-4 font-bold text-white">{w.quantity ? Number(w.quantity).toLocaleString('tr-TR') : '-'}</td>
                        <td className="p-4 text-xs text-slate-400">
                          <div className="font-semibold text-slate-300">T: {w.carrier_company || '-'}</div>
                          <div className="text-[10px] text-slate-500">B: {w.disposal_company || '-'}</div>
                        </td>
                        <td className="p-4 text-slate-450">{w.dispatch_date ? new Date(w.dispatch_date).toLocaleDateString('tr-TR') : '-'}</td>
                        <td className="p-4 font-mono text-xs text-slate-450">{w.motat_number || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: REPORTS & VISITS */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            
            {/* Visit Schedules */}
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Danışman Ziyaret Planları</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 rounded text-slate-400">{visits.length} Toplam</span>
              </div>

              {visits.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-medium">Planlanmış veya gerçekleşmiş ziyaret kaydı bulunmuyor.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                        <th className="p-4">Ziyaret Tarihi</th>
                        <th className="p-4">Ziyaret Amacı / Açıklama</th>
                        <th className="p-4">Süre (Saat)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visits.map((v) => (
                        <tr key={v.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition text-slate-350">
                          <td className="p-4 font-bold text-teal-400">{new Date(v.visit_date).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 font-semibold text-slate-200">{v.purpose || '-'}</td>
                          <td className="p-4">{v.duration_hours || '-'} Saat</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Environmental Reports */}
            <div className="bg-slate-900/20 border border-slate-850 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex justify-between items-center">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Yayınlanmış Çevre Raporları</h3>
                <span className="text-xs font-medium px-2 py-0.5 bg-slate-800 rounded text-slate-400">{reports.length} Rapor</span>
              </div>

              {reports.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-xs font-medium">Yüklenmiş veya imzalanmış çevre raporu bulunmuyor.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-bold">
                        <th className="p-4">Rapor Başlığı</th>
                        <th className="p-4">Dönem</th>
                        <th className="p-4">Islak İmzalı Rapor</th>
                        <th className="p-4">Oluşturulma Tarihi</th>
                        <th className="p-4 text-right">Dosya</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.map((r) => (
                        <tr key={r.id} className="border-b border-slate-850 hover:bg-slate-900/30 transition text-slate-350">
                          <td className="p-4 font-bold text-slate-200">{r.title || 'Çevre Raporu'}</td>
                          <td className="p-4">{r.period || '-'}</td>
                          <td className="p-4">
                            {r.wet_signature_url ? (
                              <a 
                                href={r.wet_signature_url} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-teal-400 font-bold hover:underline"
                              >
                                Islak İmzalı Raporu Gör ↗
                              </a>
                            ) : (
                              <span className="text-slate-500">Henüz Yüklenmedi</span>
                            )}
                          </td>
                          <td className="p-4">{new Date(r.created_at).toLocaleDateString('tr-TR')}</td>
                          <td className="p-4 text-right">
                            {r.file_url ? (
                              <a 
                                href={r.file_url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-teal-450 hover:text-teal-300 font-bold inline-flex items-center gap-1"
                              >
                                İndir <Download size={12} />
                              </a>
                            ) : (
                              <span className="text-slate-600">Yok</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="mt-auto py-6 border-t border-slate-900 text-center text-[10px] text-slate-500">
        © {new Date().getFullYear()} EvrakLab Müşteri Portalı. Tüm hakları saklıdır.
      </footer>

    </div>
  );
}
