import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { FileSignature, ArrowLeft, Save, Loader, Lock } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  logo_url?: string;
}

export default function OpinionLetterForm() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [loadingClients, setLoadingClients] = useState(true);
  const [clients, setClients] = useState<Client[]>([]);
  const [noAssignedClients, setNoAssignedClients] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isPremiumActive, setIsPremiumActive] = useState(true);

  const [clientId, setClientId] = useState('');
  const [subject, setSubject] = useState('');
  const [letterDate, setLetterDate] = useState(new Date().toISOString().split('T')[0]);
  const [institutionName, setInstitutionName] = useState('');
  const [content, setContent] = useState('');
  const [loadingInstitution, setLoadingInstitution] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (clientId) fetchLastInstitutionName(clientId);
  }, [clientId]);

  const fetchInitialData = async () => {
    setLoadingClients(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, role, organization_id, extra_permissions')
        .eq('id', session.user.id)
        .single();

      if (!profile) return;
      setUserProfile(profile);
      const perms = profile.extra_permissions || {};

      if (profile.role === 'admin' || profile.role === 'system_admin') {
        setIsPremiumActive(true);
      } else if (profile.organization_id) {
        const { data: org } = await supabase
          .from('organizations')
          .select('subscription_end_date')
          .eq('id', profile.organization_id)
          .single();
        setIsPremiumActive(!!org?.subscription_end_date && new Date(org.subscription_end_date) > new Date());
      } else {
        setIsPremiumActive(false);
      }

      let query = supabase.from('consultant_clients').select('id, name, logo_url');
      const isRestrictedRole = profile.role === 'corporate_staff' || profile.role === 'corporate_chief';

      if (profile.role !== 'admin' && isRestrictedRole && !perms.can_view_all_clients) {
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', session.user.id);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) {
          query = query.in('id', cIds);
        } else {
          setNoAssignedClients(true);
          setLoadingClients(false);
          return;
        }
      } else if (profile.role !== 'admin') {
        query = query.eq('consultant_company_id', profile.organization_id);
      }

      const { data: clientsData } = await query.order('name', { ascending: true });
      if (clientsData) setClients(clientsData);
    } finally {
      setLoadingClients(false);
    }
  };

  const fetchLastInstitutionName = async (cId: string) => {
    setLoadingInstitution(true);
    try {
      const { data } = await supabase
        .from('opinion_letters')
        .select('institution_name')
        .eq('client_id', cId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.institution_name) {
        setInstitutionName(data.institution_name);
      }
    } finally {
      setLoadingInstitution(false);
    }
  };

  const handleSave = async () => {
    if (!isPremiumActive) return alert('Premium süreniz doldu. Görüş oluşturmak için lütfen paketinizi yenileyin.');
    if (!clientId) return alert('Lütfen görüşün hazırlanacağı işletmeyi seçin.');
    if (!subject.trim()) return alert('Lütfen konu girin.');
    if (!letterDate) return alert('Lütfen tarih girin.');
    if (!institutionName.trim()) return alert('Lütfen görüşün yazılacağı kurumu girin.');
    if (!content.trim()) return alert('Lütfen görüş metnini yazın.');

    setLoading(true);
    try {
      // Bu işletme + bu yıl için sıradaki "Sayı" numarasını hesapla (ör. 2026'nın ilk görüşü: 1 -> "2026-01").
      // Reddedilen görüşlerin numarası boşa çıkarılır (bkz. handleAnswer), bu yüzden burada
      // kullanılmayan en küçük numara seçilir; böylece reddedilen bir numara tekrar kullanılabilir.
      const year = new Date(letterDate).getFullYear();
      const { data: existingNos } = await supabase
        .from('opinion_letters')
        .select('sequence_no')
        .eq('client_id', clientId)
        .gte('letter_date', `${year}-01-01`)
        .lte('letter_date', `${year}-12-31`)
        .not('sequence_no', 'is', null);
      const usedNumbers = new Set((existingNos || []).map((r: any) => r.sequence_no));
      let sequenceNo = 1;
      while (usedNumbers.has(sequenceNo)) sequenceNo++;

      const { data, error } = await supabase
        .from('opinion_letters')
        .insert({
          client_id: clientId,
          organization_id: userProfile?.organization_id,
          subject: subject.trim(),
          letter_date: letterDate,
          sequence_no: sequenceNo,
          institution_name: institutionName.trim(),
          content: content.trim(),
          created_by: userProfile?.id,
          status: 'pending',
        })
        .select('id')
        .single();

      if (error) throw error;
      navigate(`/consultant/opinions/${data.id}`);
    } catch (err: any) {
      alert('Görüş kaydedilirken hata: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loadingClients) {
    return <div className="p-8 text-center text-gray-500">Yükleniyor...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/documents')}
          className="p-2 text-gray-500 hover:text-gray-900 bg-gray-100 dark:bg-slate-800 dark:text-gray-300 rounded-lg transition"
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
            <FileSignature className="text-purple-600" size={22} /> Yeni Görüş Yazısı Hazırla
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Bir kuruma gönderilecek görüş taslağını hazırlayın. Kaydettiğinizde yöneticinizin/şefinizin onayına gönderilir.
          </p>
        </div>
      </div>

      {!isPremiumActive ? (
        <div className="bg-white dark:bg-slate-800 p-10 rounded-2xl border border-gray-200 dark:border-slate-700 text-center space-y-3">
          <Lock className="mx-auto text-gray-400" size={32} />
          <p className="text-sm font-bold text-gray-700 dark:text-gray-300">Premium süreniz doldu</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
            Yeni görüş yazısı oluşturabilmek için paketinizi yenilemeniz gerekiyor.
          </p>
          <Link
            to="/pricing"
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition"
          >
            Paketi Yenile
          </Link>
        </div>
      ) : noAssignedClients ? (
        <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl border border-gray-200 dark:border-slate-700 text-center text-sm text-gray-500">
          Görüş hazırlayabileceğiniz atanmış bir işletmeniz bulunmuyor.
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">İşletme (Belge Lokasyonu) *</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold text-gray-700 dark:text-gray-300 border-gray-200"
            >
              <option value="">-- İşletme Seçin --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">Konu *</label>
              <input
                type="text"
                placeholder="Örn: Çevre İzni Görüşü"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold text-gray-700 dark:text-gray-300 border-gray-200"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">Tarih *</label>
              <input
                type="date"
                value={letterDate}
                onChange={(e) => setLetterDate(e.target.value)}
                className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold text-gray-700 dark:text-gray-300 border-gray-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">
              Görüşün Yazılacağı Kurum *
              {loadingInstitution && <span className="normal-case font-normal text-gray-400 ml-2">(önceki kayıt aranıyor...)</span>}
            </label>
            <input
              type="text"
              placeholder="Örn: Türkiye Cumhuriyeti Çevre, Şehircilik ve İklim Değişikliği Bakanlığı YALOVA"
              value={institutionName}
              onChange={(e) => setInstitutionName(e.target.value)}
              className="w-full p-2.5 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 text-sm font-semibold text-gray-700 dark:text-gray-300 border-gray-200"
            />
            <p className="text-[10px] text-gray-400 mt-1">Bu işletme için daha önce girilmişse otomatik doldurulur, dilerseniz değiştirebilirsiniz.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 dark:text-gray-400 mb-1.5 uppercase">Görüş Metni *</label>
            <textarea
              rows={10}
              placeholder="Kuruma iletilecek görüş metnini buraya yazın..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full p-3 rounded-xl border bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-purple-500 text-sm text-gray-700 dark:text-gray-300 border-gray-200 resize-y"
            />
          </div>

          <div className="flex justify-end pt-2 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl font-bold transition"
            >
              {loading ? <Loader size={16} className="animate-spin" /> : <Save size={16} />}
              Kaydet ve Onaya Gönder
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
