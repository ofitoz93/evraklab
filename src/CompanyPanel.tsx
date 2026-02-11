import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import {
  Users,
  Ticket,
  Copy,
  Trash2,
  Mail,
  Shield,
  UserCog,
  CheckSquare,
  Square,
  PieChart,
  AlertCircle,
  Building,
  Lock,
  Send,
  Clock,
  User,
  Loader,
  Crown,
} from 'lucide-react';

export default function CompanyPanel() {
  const [loading, setLoading] = useState(true);
  const [myOrg, setMyOrg] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [invitations, setInvitations] = useState<any[]>([]);
  const [myProfile, setMyProfile] = useState<any>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  // Yetki İsimleri
  const permLabels: any = {
    can_invite: 'Davet Yetkisi',
    can_view_team_docs: 'Ekip Dosyalarını Gör',
    can_edit_team_docs: 'Dosya Düzenle',
    can_delete_team_docs: 'Dosya Sil',
  };

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, organization:organizations(*)')
          .eq('id', session.user.id)
          .single();
        setMyProfile(profile);

        if (profile?.organization_id) {
          setMyOrg(profile.organization);

          // 1. MEVCUT ÜYELER
          let query = supabase
            .from('profiles')
            .select('*')
            .eq('organization_id', profile.organization_id);

          if (profile.role === 'premium_corporate')
            query = query.neq('id', session.user.id);

          const { data: members } = await query.order('role', { ascending: true });
          setTeamMembers(members || []);

          // 2. BEKLEYEN DAVETLER (Kodlar)
          const { data: invites } = await supabase
            .from('invitations')
            .select('*')
            .eq('organization_id', profile.organization_id)
            .eq('is_used', false) // Kullanılmamış kodlar
            .order('created_at', { ascending: false });
          setInvitations(invites || []);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const isCorporateAdmin = myProfile?.role === 'premium_corporate';
  const canInvite = isCorporateAdmin || (myProfile?.role === 'corporate_chief' && myProfile?.permissions?.can_invite);
  const isExpired = myProfile?.role === 'normal' && myProfile?.organization_id;

  const billableMembersCount = teamMembers.filter((m) => m.role !== 'premium_corporate').length;
  const totalUsed = billableMembersCount + invitations.length;
  const maxLimit = myOrg?.member_limit || 5;
  const usagePercent = Math.min(100, (totalUsed / maxLimit) * 100);
  const isFull = totalUsed >= maxLimit;

  // --- KOD ÜRETME FONKSİYONU ---
  const handleCreateCode = async () => {
    if (totalUsed >= maxLimit) return alert('Kapasite dolu! Personel sınırına ulaştınız.');
    
    // 6 Haneli Rastgele Kod
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
      const { error } = await supabase
        .from('invitations')
        .insert([{ 
            code, 
            organization_id: myOrg.id, 
            email: null, // Manuel kod olduğu için email yok
            is_used: false 
        }]);

      if (error) throw error;
      
      alert(`✅ Kod Oluşturuldu: ${code}`);
      fetchCompanyData();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (!window.confirm('Davetiyeyi/Kodu iptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  // ... (Diğer rol değiştirme fonksiyonları aynı kalacak, sadece UI render kısmı aşağıdadır)

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kod kopyalandı: ' + code);
  };

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;
  if (!myOrg) return <div className="p-8 text-center text-gray-500">Herhangi bir şirkete bağlı değilsiniz.</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6 relative">
      {/* Üst Bilgi ve Kota Barı (Aynı kalacak) */}
      <div className="bg-white p-6 rounded-xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Building className="text-purple-600" /> {myOrg.name}
            </h1>
            <span className="text-sm text-gray-500">Yönetim Paneli</span>
          </div>
          {/* Kota Göstergesi */}
          <div className="w-full md:w-1/3 bg-gray-50 p-4 rounded-xl border">
            <div className="flex justify-between items-end mb-2">
              <div className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1">
                <PieChart size={14} /> Kota
              </div>
              <div className="text-xl font-black text-gray-800">
                {totalUsed} <span className="text-sm text-gray-400 font-medium">/ {maxLimit}</span>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
              <div className={`h-2.5 rounded-full ${isFull ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${usagePercent}%` }}></div>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* SOL: EKİP LİSTESİ VE DAVETLER */}
        <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Users size={20} /> Ekip ve Bekleyen Kodlar
          </h3>
          
          <div className="space-y-4">
            {/* Mevcut Üyeler */}
            {teamMembers.map((member) => (
                <div key={member.id} className="p-4 rounded-lg border bg-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                            <User size={20} />
                        </div>
                        <div>
                            <div className="font-bold text-gray-800">{member.full_name}</div>
                            <div className="text-xs text-gray-500">{member.email}</div>
                        </div>
                    </div>
                    <span className="text-xs font-bold bg-gray-100 px-2 py-1 rounded">{member.role}</span>
                </div>
            ))}

            {/* Bekleyen Kodlar */}
            {invitations.map((i) => (
              <div key={i.id} className="p-4 rounded-lg border-2 border-dashed border-purple-200 bg-purple-50 flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-purple-600 shadow-sm">
                    <Ticket size={20} />
                  </div>
                  <div>
                    <div className="font-bold text-purple-900 text-lg tracking-wider font-mono">{i.code}</div>
                    <div className="text-xs text-purple-600">Manuel Oluşturulan Kod</div>
                  </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => copyCode(i.code)} className="p-2 bg-white rounded border hover:bg-gray-50 text-gray-500" title="Kopyala">
                        <Copy size={16} />
                    </button>
                    <button onClick={() => handleDeleteInvite(i.id)} className="p-2 bg-white rounded border hover:bg-red-50 text-red-500" title="Sil">
                        <Trash2 size={16} />
                    </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SAĞ: İŞLEMLER */}
        <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl border shadow-sm border-purple-100">
                <h3 className="font-bold text-purple-800 mb-3 flex items-center gap-2">
                <Ticket size={18} /> Manuel Kod Üret
                </h3>
                <p className="text-xs text-gray-500 mb-4">
                    Bu kodu personele verin. Personel "Ayarlar" sayfasından bu kodu girerek giriş talebi oluşturacak.
                </p>
                <button
                onClick={handleCreateCode}
                disabled={isFull}
                className="w-full bg-purple-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                {isFull ? 'Kota Dolu' : 'Kod Oluştur'}
                </button>
            </div>
        </div>

      </div>
    </div>
  );
}
