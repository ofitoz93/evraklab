import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  BarChart3, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Building,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function ComplianceDashboard() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [orgId, setOrgId] = useState('');

  const months = [
    'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
  ];

  useEffect(() => {
    fetchData();
  }, [currentYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('organization_id, role')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        setOrgId(profile.organization_id);
        
        // 1. İşletmeleri çek
        const { data: clientsData } = await supabase
          .from('consultant_clients')
          .select('*')
          .eq('consultant_company_id', profile.organization_id)
          .order('name');
        
        setClients(clientsData || []);

        // 2. Bu yılın raporlarını çek
        const startDate = `${currentYear}-01-01`;
        const endDate = `${currentYear}-12-31`;

        const { data: reportsData } = await supabase
          .from('env_reports')
          .select('id, client_id, report_date, report_type, status')
          .eq('consultant_company_id', profile.organization_id)
          .gte('report_date', startDate)
          .lte('report_date', endDate);
        
        setReports(reportsData || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getCellStatus = (clientId: string, monthIndex: number) => {
    const month = monthIndex + 1;
    const today = new Date();
    const currentMonth = today.getMonth() + 1;
    const isPastMonth = (currentYear < today.getFullYear()) || (currentYear === today.getFullYear() && month < currentMonth);
    const isCurrentMonth = currentYear === today.getFullYear() && month === currentMonth;

    // Bu aya ait rapor var mı?
    const report = reports.find(r => {
      const rDate = new Date(r.report_date);
      return r.client_id === clientId && r.report_type === 'monthly' && (rDate.getMonth() + 1) === month && rDate.getFullYear() === currentYear;
    });

    if (report) {
      return { status: 'completed', id: report.id };
    }

    if (isPastMonth) {
      return { status: 'overdue' };
    }

    if (isCurrentMonth) {
      return { status: 'pending' };
    }

    return { status: 'future' };
  };

  const getYearlyStatus = (clientId: string) => {
    const yearlyReports = reports.filter(r => r.client_id === clientId && r.report_type === 'yearly');
    
    if (yearlyReports.length > 0) {
      return { status: 'completed', reports: yearlyReports };
    }

    const today = new Date();
    if (currentYear < today.getFullYear()) {
      return { status: 'overdue' };
    }

    return { status: 'pending' };
  };

  if (loading) return <div className="p-12 text-center text-gray-500">Veriler Hazırlanıyor...</div>;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl">
            <BarChart3 size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold">Uyumluluk ve Rapor Takip Paneli</h1>
            <p className="text-xs text-gray-500">Tüm işletmelerin aylık rapor durumlarını buradan izleyin.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-slate-900 p-2 rounded-xl border">
          <button 
            onClick={() => setCurrentYear(prev => prev - 1)}
            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="font-bold px-4">{currentYear}</span>
          <button 
            onClick={() => setCurrentYear(prev => prev + 1)}
            className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
           <div className="flex justify-between items-center">
             <p className="text-sm font-medium text-gray-500">Toplam İşletme</p>
             <Building className="text-blue-500" size={20} />
           </div>
           <p className="text-3xl font-black mt-2">{clients.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
           <div className="flex justify-between items-center">
             <p className="text-sm font-medium text-gray-500">Bu Yılki Raporlar</p>
             <CheckCircle className="text-green-500" size={20} />
           </div>
           <p className="text-3xl font-black mt-2">{reports.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-100 dark:border-slate-700">
           <div className="flex justify-between items-center">
             <p className="text-sm font-medium text-gray-500">Uyumluluk Oranı</p>
             <div className="p-1 bg-green-50 text-green-600 rounded text-[10px] font-bold">%85</div>
           </div>
           <div className="mt-4 h-2 bg-gray-100 rounded-full overflow-hidden">
             <div className="h-full bg-green-500 w-[85%]"></div>
           </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-900/50 border-b dark:border-slate-700">
                <th className="p-4 text-left font-bold text-sm text-gray-600 dark:text-gray-400 sticky left-0 bg-gray-50 dark:bg-slate-900 z-10 w-64">İşletme Adı</th>
                {months.map((m, idx) => (
                  <th key={m} className="p-4 text-center font-bold text-[10px] uppercase tracking-wider text-gray-500 min-w-[80px]">
                    {m}
                  </th>
                ))}
                <th className="p-4 text-center font-bold text-[10px] uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-900/20 min-w-[100px] border-l dark:border-slate-700">
                  İç Tetkik
                </th>
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-slate-700">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50 dark:hover:bg-blue-900/10 transition">
                  <td className="p-4 text-sm font-bold border-r dark:border-slate-700 sticky left-0 bg-white dark:bg-slate-800 z-10 shadow-sm">
                    {client.name}
                  </td>
                  {months.map((m, idx) => {
                    const result = getCellStatus(client.id, idx);
                    return (
                      <td key={idx} className="p-2 text-center">
                        {result.status === 'completed' ? (
                          <button 
                            onClick={() => navigate(`/consultant/reports/${result.id}`)}
                            className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center mx-auto hover:scale-110 transition shadow-sm border border-green-200"
                            title="Raporu Gör"
                          >
                            <CheckCircle size={16} />
                          </button>
                        ) : result.status === 'overdue' ? (
                          <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 flex items-center justify-center mx-auto animate-pulse border border-red-200" title="Süresi Geçti!">
                            <AlertCircle size={16} />
                          </div>
                        ) : result.status === 'pending' ? (
                          <div className="w-8 h-8 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 flex items-center justify-center mx-auto border border-yellow-200" title="Yüklenmesi Bekleniyor">
                            <Clock size={16} />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-gray-50 dark:bg-slate-700/50 text-gray-300 flex items-center justify-center mx-auto border border-gray-100 dark:border-slate-800">
                            <FileText size={14} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                  
                  {/* Yearly Audit Column */}
                  <td className="p-2 text-center border-l dark:border-slate-700 bg-blue-50/30 dark:bg-blue-900/5">
                    {(() => {
                      const result = getYearlyStatus(client.id);
                      if (result.status === 'completed') {
                        return (
                          <div className="flex flex-wrap justify-center gap-1">
                            {result.reports?.map((r: any, i: number) => (
                              <button 
                                key={r.id}
                                onClick={() => navigate(`/consultant/reports/${r.id}`)}
                                className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:scale-110 transition shadow-md"
                                title={`İç Tetkik Raporu ${i + 1}`}
                              >
                                {result.reports!.length > 1 ? i + 1 : <CheckCircle size={16} />}
                              </button>
                            ))}
                          </div>
                        );
                      }
                      if (result.status === 'overdue') {
                        return (
                          <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mx-auto border border-red-200 animate-pulse">
                            <AlertCircle size={16} />
                          </div>
                        );
                      }
                      return (
                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-300 flex items-center justify-center mx-auto border border-blue-100">
                           <Clock size={16} />
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              ))}
              {clients.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-12 text-center text-gray-500">
                    Henüz hiçbir işletme eklenmemiş.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border text-xs font-medium text-gray-500 justify-center">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-green-500"></div> Rapor Yüklendi
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-red-500"></div> Süresi Geçti (Eksik)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-yellow-500"></div> Bekleyen (Bu Ay)
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gray-300"></div> Gelecek Dönem
        </div>
      </div>
    </div>
  );
}
