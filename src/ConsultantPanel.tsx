import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Building,
  Plus,
  Edit2,
  Trash2,
  Users,
  FileText,
  Search,
  Upload,
  AlertCircle,
  CheckCircle,
  Clock,
  Eye,
  Settings as SettingsIcon,
  Copy,
  Mail,
  User,
  MapPin,
  Tag,
  Loader,
} from 'lucide-react';
import { Link } from 'react-router-dom';

interface Client {
  id: string;
  name: string;
  address: string;
  tax_no: string;
  phone: string;
  logo_url: string;
  created_by?: string;
  created_at?: string;
}

interface Report {
  id: string;
  client_id: string;
  report_type: 'monthly' | 'yearly';
  report_date: string;
  expires_at: string;
  status: string;
  client: { name: string };
  creator: { full_name: string };
  is_manual_upload: boolean;
  file_url: string;
  wet_signature_url: string | null;
  wet_signed_at: string | null;
}

export default function ConsultantPanel() {
  const [activeTab, setActiveTab] = useState<'clients' | 'reports' | 'settings' | 'team' | 'definitions'>('clients');
  const [clients, setClients] = useState<Client[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [userId, setUserId] = useState('');
  const [orgId, setOrgId] = useState('');
  const [currentUserPerms, setCurrentUserPerms] = useState<any>({});

  // Tanımlamalar Tab State'leri
  const [defTabTypes, setDefTabTypes] = useState<any[]>([]);
  const [defTabLocs, setDefTabLocs] = useState<any[]>([]);
  const [rawDefs, setRawDefs] = useState<any[]>([]);
  const [selectedDefMemberId, setSelectedDefMemberId] = useState<string>('all');
  const [selectedDefTypeMemberId, setSelectedDefTypeMemberId] = useState<string>('all');
  const [newDefTypeLabel, setNewDefTypeLabel] = useState('');
  const [newDefLocLabel, setNewDefLocLabel] = useState('');
  const [savingDef, setSavingDef] = useState(false);
  const [clientNames, setClientNames] = useState<string[]>([]);

  // Modals
  const [showAddClient, setShowAddClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    address: '',
    tax_no: '',
    phone: '',
    logo_url: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [orgData, setOrgData] = useState<any>(null);
  const [savingOrg, setSavingOrg] = useState(false);
  const [showEditClient, setShowEditClient] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);

  // Assignment Modal
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [currentAssignments, setCurrentAssignments] = useState<string[]>([]);

  // Ekip Yönetimi (Yönetici Paneli) State'leri
  const [invitations, setInvitations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sendingEmail, setSendingEmail] = useState(false);

  const roleLabels: any = {
    premium_corporate: 'Çevre Danışmanlık Firma Sahibi',
    corporate_chief: 'Çevre Danışmanlık Firma Yöneticisi',
    corporate_staff: 'Çevre Danışmanlık Personeli',
    normal: 'Normal (Ekip Dışı)',
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if ((activeTab === 'settings' || activeTab === 'team' || activeTab === 'definitions') && orgId) {
      fetchTeamMembers();
    }
    if (activeTab === 'team' && orgId) {
      fetchInvitations();
    }
    if (activeTab === 'definitions' && orgId) {
      fetchDefinitionsTab();
    }
  }, [activeTab, orgId]);

  const fetchTeamMembers = async () => {
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, extra_permissions')
      .eq('organization_id', orgId);
    setTeamMembers(members || []);
  };

  const fetchInvitations = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('invitations')
      .select('*')
      .eq('organization_id', orgId)
      .eq('is_used', false)
      .order('created_at', { ascending: false });
    setInvitations(data || []);
  };

  const groupDefinitions = (defs: any[], orgProfiles: any[]) => {
    const grouped: any[] = [];
    const labelGroups = new Map<string, any[]>();
    
    // Group by label (case-insensitive)
    defs.forEach(d => {
      if (!d.label) return;
      const key = d.label.trim().toLowerCase();
      if (!labelGroups.has(key)) {
        labelGroups.set(key, []);
      }
      labelGroups.get(key)!.push(d);
    });

    const activeMemberIds = orgProfiles.map(m => m.id);

    labelGroups.forEach((rows, labelKey) => {
      const rowUserIds = rows.map(r => r.user_id);
      // Check if this label covers all active team members
      const coversAll = activeMemberIds.length > 0 && activeMemberIds.every(id => rowUserIds.includes(id));

      if (coversAll) {
        grouped.push({
          id: `group:${rows.map(r => r.id).join(',')}`,
          label: rows[0].label,
          isGroup: true,
          rowIds: rows.map(r => r.id),
          ownerName: 'Tüm Ekip',
          category: rows[0].category,
          created_at: rows[0].created_at
        });
      } else {
        rows.forEach(r => {
          grouped.push({
            ...r,
            isGroup: false,
            rowIds: [r.id],
            ownerName: r.user?.full_name || 'Bilinmeyen'
          });
        });
      }
    });

    return grouped.sort((a, b) => a.label.localeCompare(b.label));
  };

  const fetchDefinitionsTab = async () => {
    if (!orgId) return;
    try {
      const { data: orgProfiles } = await supabase
        .from('profiles')
        .select('id')
        .eq('organization_id', orgId);

      const { data: defs, error } = await supabase
        .from('user_definitions')
        .select('*, user:profiles!user_id(full_name)')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Fetch company names to prevent deletion of registered business locations
      const { data: clientsData } = await supabase
        .from('consultant_clients')
        .select('name')
        .eq('consultant_company_id', orgId);
      setClientNames(clientsData?.map(c => c.name) || []);

      if (defs) {
        setRawDefs(defs);
        const groupedTypes = groupDefinitions(defs.filter(d => d.category === 'doc_type'), orgProfiles || []);
        const groupedLocs = groupDefinitions(defs.filter(d => d.category === 'location'), orgProfiles || []);
        setDefTabTypes(groupedTypes);
        setDefTabLocs(groupedLocs);
      }
    } catch (err: any) {
      console.error('Tanımlar çekilirken hata:', err.message);
    }
  };

  const handleAddTabDocType = async () => {
    if (!newDefTypeLabel.trim()) return;
    
    const exists = rawDefs.some(t => t.category === 'doc_type' && t.label && t.label.toLowerCase() === newDefTypeLabel.trim().toLowerCase() &&
      (selectedDefTypeMemberId === 'all' || t.user_id === selectedDefTypeMemberId)
    );
    if (exists) {
      alert(`⛔ "${newDefTypeLabel.trim()}" seçilen kapsamda zaten tanımlanmış!`);
      return;
    }

    setSavingDef(true);
    try {
      let targetUserIds: string[] = [];
      if (selectedDefTypeMemberId === 'all') {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', orgId);
        targetUserIds = orgProfiles?.map(p => p.id) || [];
      } else {
        targetUserIds = [selectedDefTypeMemberId];
      }

      if (targetUserIds.length === 0) return;

      const inserts = targetUserIds.map(uid => ({
        user_id: uid,
        category: 'doc_type',
        label: newDefTypeLabel.trim(),
        organization_id: orgId
      }));

      const { error } = await supabase
        .from('user_definitions')
        .insert(inserts);

      if (error) throw error;
      setNewDefTypeLabel('');
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Belge türü eklenirken hata: ' + err.message);
    } finally {
      setSavingDef(false);
    }
  };

  const handleAddTabLocation = async () => {
    if (!newDefLocLabel.trim()) return;

    const exists = rawDefs.some(l => l.category === 'location' && l.label && l.label.toLowerCase() === newDefLocLabel.trim().toLowerCase() && 
      (selectedDefMemberId === 'all' || l.user_id === selectedDefMemberId)
    );
    if (exists) {
      alert(`⛔ "${newDefLocLabel.trim()}" seçilen kapsamda zaten tanımlanmış!`);
      return;
    }

    setSavingDef(true);
    try {
      let targetUserIds: string[] = [];
      if (selectedDefMemberId === 'all') {
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', orgId);
        targetUserIds = orgProfiles?.map(p => p.id) || [];
      } else {
        targetUserIds = [selectedDefMemberId];
      }

      if (targetUserIds.length === 0) return;

      const inserts = targetUserIds.map(uid => ({
        user_id: uid,
        category: 'location',
        label: newDefLocLabel.trim(),
        organization_id: orgId
      }));

      const { error } = await supabase
        .from('user_definitions')
        .insert(inserts);

      if (error) throw error;
      setNewDefLocLabel('');
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Lokasyon eklenirken hata: ' + err.message);
    } finally {
      setSavingDef(false);
    }
  };

  const handleDeleteTabDefinition = async (id: string) => {
    let idsToDelete: string[] = [];
    let isBusiness = false;
    let label = '';

    if (id.startsWith('group:')) {
      idsToDelete = id.substring(6).split(',');
      const firstId = idsToDelete[0];
      const match = rawDefs.find(d => d.id === firstId);
      if (match) {
        label = match.label;
      }
    } else {
      idsToDelete = [id];
      const match = rawDefs.find(d => d.id === id);
      if (match) {
        label = match.label;
      }
    }

    if (label) {
      isBusiness = clientNames.some(
        cName => cName && label && cName.trim().toLowerCase() === label.trim().toLowerCase()
      );
      if (isBusiness) {
        alert('⛔ Kayıtlı bir işletmeye ait lokasyon silinemez!');
        return;
      }
    }

    if (!window.confirm('Bu tanımı silmek istediğinize emin misiniz? Bu işlem bağlı belgeleri etkileyebilir.')) return;
    try {
      const { error } = await supabase
        .from('user_definitions')
        .delete()
        .in('id', idsToDelete);
      if (error) throw error;
      await fetchDefinitionsTab();
    } catch (err: any) {
      alert('Silme işlemi başarısız: ' + err.message);
    }
  };

  const handleSendEmailInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!inviteEmail.includes('@')) return alert('Geçerli bir e-posta adresi giriniz.');

    setSendingEmail(true);
    try {
      const { data: existingInvite } = await supabase
        .from('invitations')
        .select('id')
        .eq('organization_id', orgId)
        .eq('email', inviteEmail)
        .eq('is_used', false)
        .maybeSingle();

      if (existingInvite) {
        alert('⚠️ Bu kullanıcıya zaten bekleyen bir davet var.');
        setSendingEmail(false);
        return;
      }

      const { data: targetUser, error: userError } = await supabase
        .from('profiles')
        .select('id, full_name, organization_id')
        .eq('email', inviteEmail)
        .single();

      if (userError || !targetUser) {
        alert('❌ Kullanıcı Bulunamadı! (Sisteme kayıtlı olması gerekir)');
        setSendingEmail(false);
        return;
      }
      if (targetUser.organization_id) {
        alert('⚠️ Bu kullanıcı zaten bir şirkete/firmaya bağlı.');
        setSendingEmail(false);
        return;
      }

      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const { error: inviteError } = await supabase
        .from('invitations')
        .insert([{ code, organization_id: orgId, email: inviteEmail }]);

      if (inviteError) throw inviteError;

      await supabase.from('notifications').insert([
        {
          user_id: targetUser.id,
          title: 'Danışmanlık Firması Daveti',
          message: `${orgData?.name || 'Danışmanlık Firması'} sizi ekibine katılmaya davet etti.`,
          type: 'invite',
          metadata: {
            org_id: orgId,
            org_name: orgData?.name,
            invite_code: code,
          },
        },
      ]);

      alert(`✅ Davet başarıyla gönderildi!`);
      setInviteEmail('');
      fetchInvitations();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCreateCode = async () => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      const { error } = await supabase
        .from('invitations')
        .insert([
          { code, organization_id: orgId, email: null, is_used: false },
        ]);
      if (error) throw error;
      alert(`✅ Davet Kodu Oluşturuldu: ${code}`);
      fetchInvitations();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    }
  };

  const handleDeleteInvite = async (id: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!window.confirm('Bu daveti iptal etmek istiyor musunuz?')) return;
    await supabase.from('invitations').delete().eq('id', id);
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    alert('Kopyalandı: ' + code);
  };

  const handleKick = async (id: string, role: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (role === 'premium_corporate') return alert('Yöneticiyi silemezsiniz.');
    if (window.confirm('Bu personeli şirketten çıkarmak istiyor musunuz?')) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ organization_id: null, role: 'normal' })
          .eq('id', id);
        if (error) throw error;
        setTeamMembers((prev) => prev.filter((m) => m.id !== id));
      } catch (err: any) {
        alert('Çıkarılırken hata oluştu: ' + err.message);
      }
    }
  };

  const handleUpdateRole = async (memberId: string, role: string) => {
    if (userRole !== 'premium_corporate') {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      const updates: any = { role };
      if (role === 'normal') {
        updates.organization_id = null;
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', memberId);

      if (error) throw error;
      alert('Kullanıcı rolü başarıyla güncellendi.');
      fetchTeamMembers();
    } catch (err: any) {
      alert('Rol güncellenemedi: ' + err.message);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditMode = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      // NOT: Supabase'de 'client_assets' adında public bir bucket oluşturulmuş olmalıdır.
      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      if (isEditMode) {
        setEditingClient((prev: any) => ({ ...prev, logo_url: data.publicUrl }));
      } else {
        setNewClient({ ...newClient, logo_url: data.publicUrl });
      }
    } catch (err: any) {
      alert('Logo yüklenirken hata: ' + err.message + '\nLütfen Supabase panelinden "client_assets" adında public bir bucket oluşturduğunuzdan emin olun.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleOrgLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `org_${Math.random()}.${fileExt}`;
      const filePath = `logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('client_assets')
        .getPublicUrl(filePath);

      const newLogoUrl = data.publicUrl;

      // Hemen veritabanına kaydet
      const { error: dbError } = await supabase
        .from('organizations')
        .update({ consultant_logo_url: newLogoUrl })
        .eq('id', orgId);

      if (dbError) throw dbError;

      setOrgData({ ...orgData, consultant_logo_url: newLogoUrl });
      alert('Danışman logosu başarıyla güncellendi!');
    } catch (err: any) {
      alert('Logo yüklenirken hata: ' + err.message);
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSaveOrg = async () => {
    setSavingOrg(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: orgData.name,
          consultant_logo_url: orgData.consultant_logo_url,
        })
        .eq('id', orgId);

      if (error) throw error;
      alert('Şirket ayarları başarıyla güncellendi!');
    } catch (err: any) {
      alert('Kaydedilirken hata: ' + err.message);
    } finally {
      setSavingOrg(false);
    }
  };

  const openAssignModal = async (client: any) => {
    if (!canAssignClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    setSelectedClient(client);
    setShowAssignModal(true);
    
    // Fetch team members of the consultant company
    const { data: members } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', orgId);
    setTeamMembers(members || []);

    // Fetch current assignments for this client
    const { data: assigns } = await supabase
      .from('consultant_assignments')
      .select('user_id')
      .eq('client_id', client.id);
    setCurrentAssignments(assigns?.map(a => a.user_id) || []);
  };

  const handleToggleAssign = async (uId: string) => {
    if (!canAssignClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    try {
      if (currentAssignments.includes(uId)) {
        // Remove assignment
        const { error } = await supabase
          .from('consultant_assignments')
          .delete()
          .eq('client_id', selectedClient.id)
          .eq('user_id', uId);
        if (error) throw error;
        setCurrentAssignments(prev => prev.filter(id => id !== uId));
      } else {
        // Add assignment
        const { error } = await supabase
          .from('consultant_assignments')
          .insert([{ client_id: selectedClient.id, user_id: uId }]);
        if (error) throw error;
        setCurrentAssignments(prev => [...prev, uId]);
      }
    } catch (err: any) {
      alert('Atama yapılırken hata: ' + err.message);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id, extra_permissions')
        .eq('id', session.user.id)
        .single();

        if (profile) {
        setUserRole(profile.role);
        setOrgId(profile.organization_id);
        const perms = profile.extra_permissions || {};
        setCurrentUserPerms(perms);

        if (profile.role === 'corporate_chief') {
          if (perms.can_view_team !== false) {
            setActiveTab('team');
          } else if (perms.can_view_clients !== false) {
            setActiveTab('clients');
          } else if (perms.can_view_reports !== false) {
            setActiveTab('reports');
          } else {
            setActiveTab('clients');
          }
        }

        if (profile.organization_id) {
          const { data: org } = await supabase.from('organizations').select('*').eq('id', profile.organization_id).single();
          setOrgData(org);
        }

        await Promise.all([
          fetchClients(profile.organization_id, profile.role, session.user.id, perms),
          fetchReports(profile.organization_id, profile.role, session.user.id, perms),
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async (oId: string, role: string, uId: string, perms?: any) => {
    let query = supabase.from('consultant_clients').select('*');
    
    // Kurumsal şef ve personel sadece atandığı firmaları görür (perm yoksa).
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı firmalar
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .eq('user_id', uId);
      const cIds = assignments?.map((a) => a.client_id) || [];
      if (cIds.length > 0) {
        query = query.in('id', cIds);
      } else {
        setClients([]);
        return;
      }
    } else {
      query = query.eq('consultant_company_id', oId);
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setClients(data);
  };

  const fetchReports = async (oId: string, role: string, uId: string, perms?: any) => {
    let query = supabase
      .from('env_reports')
      .select('*, client:client_id(name), creator:creator_id(full_name)');
    
    const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';

    if (isRestrictedRole && !perms?.can_view_all_clients) {
      // Sadece atandığı firmaların raporları
      const { data: assignments } = await supabase
        .from('consultant_assignments')
        .select('client_id')
        .eq('user_id', uId);
      const cIds = assignments?.map((a) => a.client_id) || [];
      if (cIds.length > 0) {
        query = query.in('client_id', cIds);
      } else {
        setReports([]);
        return;
      }
    } else {
      query = query.eq('consultant_company_id', oId);
    }
    const { data } = await query.order('created_at', { ascending: false });
    if (data) setReports(data as any);
  };

  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name) return;
    if (!canCreateClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }

    try {
      const { error } = await supabase.from('consultant_clients').insert([
        {
          consultant_company_id: orgId,
          name: newClient.name,
          address: newClient.address,
          tax_no: newClient.tax_no,
          phone: newClient.phone,
          logo_url: newClient.logo_url,
          created_by: userId,
        },
      ]);
      if (error) throw error;
      setShowAddClient(false);
      setNewClient({ name: '', address: '', tax_no: '', phone: '', logo_url: '' });
      fetchClients(orgId, userRole, userId);
    } catch (err: any) {
      alert('Firma eklenirken hata: ' + err.message);
    }
  };

  const handleOpenEditModal = (client: any) => {
    if (!checkClientEditable(client)) {
      alert('Bu işletmeyi düzenleme yetkiniz bulunmamaktadır (Firma Sahibi tarafından oluşturulmuş veya oluşturulma süresi 24 saati geçmiş).');
      return;
    }
    setEditingClient(client);
    setShowEditClient(true);
  };

  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient || !editingClient.name) return;
    if (!checkClientEditable(editingClient)) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }

    try {
      const { error } = await supabase
        .from('consultant_clients')
        .update({
          name: editingClient.name,
          address: editingClient.address,
          tax_no: editingClient.tax_no,
          phone: editingClient.phone,
          logo_url: editingClient.logo_url,
        })
        .eq('id', editingClient.id);

      if (error) throw error;
      setShowEditClient(false);
      setEditingClient(null);
      fetchClients(orgId, userRole, userId);
      alert('İşletme bilgileri başarıyla güncellendi!');
    } catch (err: any) {
      alert('Firma güncellenirken hata: ' + err.message);
    }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!canDeleteClients) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    if (!window.confirm('Bu işletmeyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz ve işletmeye ait tüm raporlar ve atamalar silinecektir.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('consultant_clients')
        .delete()
        .eq('id', clientId);

      if (error) throw error;
      fetchClients(orgId, userRole, userId);
      alert('İşletme başarıyla silindi.');
    } catch (err: any) {
      alert('Firma silinirken hata: ' + err.message);
    }
  };

  const getReportStatusColor = (report: Report) => {
    if (report.status !== 'completed' && !report.is_manual_upload) return 'bg-gray-100 text-gray-800 border-gray-200';

    // Daha yeni bir rapor var mı?
    const hasNewerReport = reports.some(r => 
      r.client_id === report.client_id && 
      r.report_type === report.report_type && 
      new Date(r.report_date) > new Date(report.report_date)
    );

    if (hasNewerReport) return 'bg-green-100 text-green-800 border-green-200';

    const expDate = new Date(report.expires_at);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return 'bg-red-100 text-red-800 border-red-200'; 
    if (diffDays <= 30) return 'bg-yellow-100 text-yellow-800 border-yellow-200'; 
    return 'bg-green-100 text-green-800 border-green-200'; 
  };

  const getReportStatusText = (report: Report) => {
    if (report.status !== 'completed' && !report.is_manual_upload) return 'Taslak';

    // Daha yeni bir rapor var mı?
    const hasNewerReport = reports.some(r => 
      r.client_id === report.client_id && 
      r.report_type === report.report_type && 
      new Date(r.report_date) > new Date(report.report_date)
    );

    if (hasNewerReport) return 'Tamamlandı';

    const expDate = new Date(report.expires_at);
    const now = new Date();
    const diffDays = Math.ceil((expDate.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (diffDays < 0) return 'Süresi Geçti';
    if (diffDays <= 30) return `Son ${diffDays} Gün`;
    return 'Geçerli Yüklendi';
  };

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  const isAdminOrChief = userRole === 'admin' || userRole === 'corporate_chief' || userRole === 'premium_corporate';
  const isManager = userRole === 'premium_corporate' || userRole === 'corporate_chief';
  
  // Granular Permissions for Chief / Staff
  const canViewClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_clients !== false);
  const canCreateClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_create_clients);
  const canEditClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_edit_clients);
  const canAssignClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_assign_clients);
  const canDeleteClients = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_delete_clients);
  const canViewReports = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_reports !== false);
  const canViewTeam = userRole === 'premium_corporate' || (userRole === 'corporate_chief' && currentUserPerms?.can_view_team !== false);


  const checkClientEditable = (client: Client) => {
    if (userRole === 'premium_corporate' || userRole === 'admin') return true;
    if (userRole === 'corporate_chief') {
      if (currentUserPerms?.can_edit_clients) return true;
      if (client.created_by === userId && client.created_at) {
        const diffMs = Date.now() - new Date(client.created_at).getTime();
        return diffMs < 24 * 60 * 60 * 1000;
      }
    }
    return false;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-blue-600" /> {userRole === 'corporate_chief' ? 'Şef Paneli' : 'Raporlar Paneli'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">İşletmelerinizi ve raporları yönetin.</p>
        </div>
          <div className="flex items-center gap-2">
            {canCreateClients && (
              <button
                onClick={() => setShowAddClient(true)}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
              >
                <Plus size={18} /> Yeni İşletme
              </button>
            )}
          {userRole !== 'corporate_chief' && (
            <Link
              to="/consultant/reports/add"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
            >
              <FileText size={18} /> Rapor Oluştur
            </Link>
          )}
        </div>
      </div>

      <div className="flex border-b border-gray-200 dark:border-slate-700">
        {canViewClients && (
          <button
            onClick={() => setActiveTab('clients')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'clients'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Building size={16} /> Hizmet Verilen İşletmeler
          </button>
        )}
        {canViewReports && (
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'reports'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText size={16} /> Raporlar
          </button>
        )}
        {canViewTeam && (
          <button
            onClick={() => setActiveTab('team')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'team'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Users size={16} /> Ekip Yönetimi
          </button>
        )}
        {userRole === 'premium_corporate' && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon size={16} /> Şirket Ayarları
          </button>
        )}

        {(userRole === 'premium_corporate' || userRole === 'corporate_chief') && (
          <button
            onClick={() => setActiveTab('definitions')}
            className={`px-6 py-3 font-medium text-sm flex items-center gap-2 border-b-2 transition ${
              activeTab === 'definitions'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <SettingsIcon size={16} /> Tanımlamalar
          </button>
        )}
      </div>

      {activeTab === 'clients' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {client.logo_url ? (
                    <img src={client.logo_url} alt="Logo" className="w-12 h-12 rounded-lg object-contain border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                      <Building size={24} />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white line-clamp-1">{client.name}</h3>
                    <p className="text-xs text-gray-500">Vergi No: {client.tax_no || 'Belirtilmemiş'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p className="line-clamp-2"><span className="font-medium">Adres:</span> {client.address}</p>
                <p><span className="font-medium">Tel:</span> {client.phone}</p>
              </div>
              {(canDeleteClients || checkClientEditable(client) || canAssignClients) && (
                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700 flex justify-between items-center gap-2">
                  <div className="flex gap-2">
                    {checkClientEditable(client) && (
                      <button 
                        onClick={() => handleOpenEditModal(client)}
                        className="text-amber-600 hover:underline text-sm flex items-center gap-1 font-medium"
                      >
                        <Edit2 size={14} /> Düzenle
                      </button>
                    )}
                    {canDeleteClients && (
                      <button 
                        onClick={() => handleDeleteClient(client.id)}
                        className="text-red-600 hover:underline text-sm flex items-center gap-1 font-medium"
                      >
                        <Trash2 size={14} /> Sil
                      </button>
                    )}
                  </div>
                  {canAssignClients && (
                    <button 
                      onClick={() => openAssignModal(client)}
                      className="text-blue-600 hover:underline text-sm flex items-center gap-1 font-medium"
                    >
                      <Users size={14} /> Personel Ata
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {clients.length === 0 && (
            <div className="col-span-full p-8 text-center text-gray-500 border-2 border-dashed border-gray-300 rounded-xl">
              Henüz bir işletme kaydı bulunmuyor.
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600">
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşletme</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rapor Türü</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Tarih</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Oluşturan</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Islak İmza</th>
                  <th className="p-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {reports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition">
                    <td className="p-4 text-sm font-medium">{report.client?.name}</td>
                    <td className="p-4 text-sm">
                      {report.report_type === 'monthly' ? 'Aylık Değerlendirme' : 'Yıllık İç Tetkik'}
                    </td>
                    <td className="p-4 text-sm">
                      {new Date(report.report_date).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="p-4 text-sm">{report.creator?.full_name || 'Bilinmiyor'}</td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${getReportStatusColor(report)}`}>
                        {getReportStatusColor(report).includes('green') && <CheckCircle size={12} />}
                        {getReportStatusColor(report).includes('yellow') && <Clock size={12} />}
                        {getReportStatusColor(report).includes('red') && <AlertCircle size={12} />}
                        {getReportStatusText(report)}
                      </span>
                    </td>
                    <td className="p-4">
                      {(report as any).wet_signature_url ? (
                        <a
                          href={(report as any).wet_signature_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 transition"
                        >
                          <CheckCircle size={12} /> Islak İmzalı
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border bg-amber-50 text-amber-700 border-amber-200">
                          <AlertCircle size={12} /> İmzalanmadı
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <Link
                        to={`/consultant/reports/${report.id}`}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg inline-flex"
                      >
                        <Eye size={18} />
                      </Link>
                    </td>
                  </tr>
                ))}
                {reports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-500">
                      Rapor bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && orgData && (
        <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn">
          {/* Şirket Bilgileri */}
          <div className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600">
              <Building size={20} /> Şirket Bilgileri ve Rapor Ayarları
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2">Şirket Ünvanı (Raporlarda Görünen)</label>
                <input
                  type="text"
                  value={orgData.name || ''}
                  onChange={(e) => setOrgData({ ...orgData, name: e.target.value })}
                  className="w-full border rounded-xl p-3 dark:bg-slate-900 dark:border-slate-700"
                  placeholder="Örn: EvrakLab Danışmanlık Ltd. Şti."
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-2">Şirket Logosu</label>
                <p className="text-xs text-gray-500 mb-3">Raporların üst kısmında danışman firma logosu olarak görünecektir.</p>
                <div className="flex items-center gap-6">
                  <div className="w-32 h-32 border rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center">
                    {orgData.consultant_logo_url ? (
                      <img src={orgData.consultant_logo_url} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                      <Building size={48} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg cursor-pointer transition text-sm font-bold">
                      <Upload size={16} /> {uploadingLogo ? 'Yükleniyor...' : 'Logoyu Değiştir'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleOrgLogoUpload} disabled={uploadingLogo} />
                    </label>
                    <p className="text-[10px] text-gray-400">Önerilen boyut: 200x100px. Arka planı şeffaf PNG önerilir.</p>
                  </div>
                </div>
              </div>

            </div>

            {/* Kaydet Butonu */}
            <div className="flex justify-end pt-4 border-t border-gray-100 dark:border-slate-700 mt-4">
              <button
                onClick={handleSaveOrg}
                disabled={savingOrg}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-bold transition disabled:opacity-50"
              >
                {savingOrg ? 'Kaydediliyor...' : '💾 Şirket Bilgilerini Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && (
        <div className="max-w-6xl mx-auto space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ekip Listesi */}
            <div className={`${userRole === 'premium_corporate' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700`}>
              <h3 className="font-bold text-gray-700 dark:text-white mb-4 flex items-center gap-2 text-lg">
                <Users className="text-blue-600" /> Ekip ve Bekleyen Kodlar
              </h3>
              
              <div className="space-y-4">
                {/* Üyeler */}
                {teamMembers.map((member) => (
                  <div key={member.id} className="p-4 rounded-xl border border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800/50 flex flex-col gap-3 hover:shadow-sm transition">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase dark:bg-blue-950/30">
                          {member.full_name?.charAt(0) || <User size={20} />}
                        </div>
                        <div>
                          <div className="font-bold text-gray-800 dark:text-white flex flex-wrap items-center gap-2">
                            {member.full_name}
                            <span className="text-[10px] px-2 py-0.5 rounded border bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900 uppercase font-semibold">
                              {roleLabels[member.role] || member.role}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">{member.email}</div>
                        </div>
                      </div>
                      
                      {userRole === 'premium_corporate' && member.id !== userId && (
                        <button
                          onClick={() => handleKick(member.id, member.role)}
                          className="text-xs bg-red-50 text-red-600 p-2 rounded border border-red-100 hover:bg-red-100 transition dark:bg-red-950/20 dark:border-red-900"
                          title="Çıkar"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>

                    {/* Rol & Yetkiler */}
                    {userRole === 'premium_corporate' && member.id !== userId && (
                      <div className="mt-2 pt-3 border-t border-gray-50 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400 font-bold">ROL:</span>
                          {userRole === 'premium_corporate' ? (
                            <select
                              value={member.role}
                              onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                              className="border rounded px-2 py-1 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 font-bold text-blue-700 dark:text-blue-400 outline-none focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="premium_corporate">Çevre Danışmanlık Firma Sahibi</option>
                              <option value="corporate_chief">Çevre Danışmanlık Firma Yöneticisi</option>
                              <option value="corporate_staff">Çevre Danışmanlık Personeli</option>
                              <option value="normal">Normal (Ekip Dışı)</option>
                            </select>
                          ) : (
                            <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                              {roleLabels[member.role] || member.role}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-3">
                          {member.role === 'corporate_chief' ? (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_clients !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletmeleri Görüntüleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_all_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_all_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Tüm Firmaları Görebilir
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_create_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_create_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Yeni İşletme Oluşturma
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_edit_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_edit_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletme Düzenleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_assign_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_assign_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Personel Atama
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_delete_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_delete_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                İşletme Silme (Kritik)
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_reports !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_reports: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Raporları Görüntüleme
                              </label>

                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_team !== false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_team: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Ekip Yönetimini Görüntüleme
                              </label>



                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.receive_reminder_cc || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), receive_reminder_cc: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Hatırlatma Maillerinde CC'de Yer Alsın
                              </label>
                            </>
                          ) : (
                            <>
                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.can_view_all_clients || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), can_view_all_clients: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Tüm Firmaları Görebilir
                              </label>


                              <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={userRole !== 'premium_corporate'}
                                  checked={member.extra_permissions?.receive_reminder_cc || false}
                                  onChange={async (e) => {
                                    const newVal = e.target.checked;
                                    const updatedPerms = { ...(member.extra_permissions || {}), receive_reminder_cc: newVal };
                                    const { error } = await supabase.from('profiles').update({ extra_permissions: updatedPerms }).eq('id', member.id);
                                    if (error) alert('Hata: ' + error.message);
                                    else setTeamMembers(prev => prev.map(m => m.id === member.id ? { ...m, extra_permissions: updatedPerms } : m));
                                  }}
                                  className="rounded border-gray-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                                />
                                Hatırlatma Maillerinde CC'de Yer Alsın
                              </label>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Bekleyen Davetler */}
                {userRole === 'premium_corporate' && invitations.map((i) => (
                  <div key={i.id} className="p-4 rounded-xl border-2 border-dashed border-purple-200 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-950/20 flex justify-between items-center opacity-90">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-purple-600 shadow-sm border dark:border-slate-700">
                        {i.email ? <Mail size={20} /> : <FileText size={20} />}
                      </div>
                      <div>
                        <div className="font-bold text-purple-900 dark:text-purple-300 text-sm">
                          {i.email ? i.email : 'Manuel Kod'}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-900 text-purple-700 dark:text-purple-400 font-mono tracking-wider">
                            {i.code}
                          </span>
                          <span className="text-[10px] text-purple-500 dark:text-purple-400">
                            {i.email ? '(E-posta Daveti)' : '(Manuel Kod)'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyCode(i.code)}
                        className="p-2 bg-white dark:bg-slate-800 rounded border hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-500 dark:text-gray-400"
                        title="Kopyala"
                      >
                        <Copy size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(i.id)}
                        className="p-2 bg-white dark:bg-slate-800 rounded border hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500"
                        title="İptal Et"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}

                {teamMembers.length <= 1 && (userRole !== 'premium_corporate' || invitations.length === 0) && (
                  <div className="text-center text-gray-400 dark:text-gray-500 py-8 italic">
                    Henüz ekip üyesi yok.
                  </div>
                )}
              </div>
            </div>

            {/* Davet Paneli (Sağ Kolon) */}
            {userRole === 'premium_corporate' && (
              <div className="space-y-6">
                {/* E-posta ile davet */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                    <Mail size={18} /> E-Posta ile Davet
                  </h3>
                  <form onSubmit={handleSendEmailInvite} className="space-y-2">
                    <input
                      type="email"
                      required
                      placeholder="personel@sirket.com"
                      className="w-full border p-2 rounded-lg text-sm outline-none focus:border-blue-500 dark:bg-slate-900 dark:border-slate-700"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                    <button
                      disabled={sendingEmail}
                      className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {sendingEmail ? 'Gönderiliyor...' : 'Davet Gönder'}
                    </button>
                  </form>
                </div>

                {/* Manuel Kod */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                  <h3 className="font-bold text-purple-800 dark:text-purple-400 mb-3 flex items-center gap-2">
                    <FileText size={18} /> Manuel Kod Üret
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                    Bu kodu personele verin. Personel "Ayarlar" sayfasından bu kodu girerek gruba katılabilir.
                  </p>
                  <button
                    onClick={handleCreateCode}
                    className="w-full bg-purple-600 text-white py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 transition"
                  >
                    Kod Oluştur
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}



      {activeTab === 'definitions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn pb-12">
          {/* BELGE TÜRLERİ */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
              <div className="p-2.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl">
                <Tag size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Belge Türleri</h2>
                <p className="text-xs text-gray-400">Ekip üyeleri veya tüm ekip için belge türlerini yönetin</p>
              </div>
            </div>

            {/* Yeni Belge Türü Ekle Formu */}
            <div className="bg-gray-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/60 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Belge Türü Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: Çevre İzin Belgesi, Atık Beyanı..."
                    value={newDefTypeLabel}
                    onChange={(e) => setNewDefTypeLabel(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ekip Üyesi Seçimi</label>
                  <select
                    value={selectedDefTypeMemberId}
                    onChange={(e) => setSelectedDefTypeMemberId(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    <option value="all">Tüm Ekip (Ortak Tanım)</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({roleLabels[m.role] || m.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                disabled={savingDef}
                onClick={handleAddTabDocType}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-blue-100 dark:shadow-none"
              >
                {savingDef ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />} Belge Türü Ekle
              </button>
            </div>

            {/* Belge Türleri Listesi */}
            <div className="max-h-[350px] overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700">
              {defTabTypes.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 italic">Tanımlı belge türü bulunamadı.</div>
              ) : (
                defTabTypes.map((type) => (
                  <div key={type.id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition group">
                    <div>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{type.label}</span>
                      <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <User size={10} /> Sahibi: {type.user?.full_name || 'Bilinmeyen'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTabDefinition(type.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                      title="Sil"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* LOKASYON TANIMLARI */}
          <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
            <div className="flex items-center gap-3 border-b border-gray-100 dark:border-slate-700 pb-4">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl">
                <MapPin size={22} />
              </div>
              <div>
                <h2 className="text-lg font-bold">Lokasyon & İşletme Tanımları</h2>
                <p className="text-xs text-gray-400">Ekip üyeleri veya tüm ekip için lokasyonları yönetin</p>
              </div>
            </div>

            {/* Yeni Lokasyon Ekle Formu */}
            <div className="bg-gray-50 dark:bg-slate-900/40 p-4 rounded-xl border border-gray-200/60 dark:border-slate-700/60 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Lokasyon Adı</label>
                  <input
                    type="text"
                    placeholder="Örn: A Şubesi, Merkez Saha..."
                    value={newDefLocLabel}
                    onChange={(e) => setNewDefLocLabel(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Ekip Üyesi Seçimi</label>
                  <select
                    value={selectedDefMemberId}
                    onChange={(e) => setSelectedDefMemberId(e.target.value)}
                    className="w-full p-2.5 border rounded-lg bg-white dark:bg-slate-900 border-gray-200 dark:border-slate-700 text-sm outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white"
                  >
                    <option value="all">Tüm Ekip (Ortak Tanım)</option>
                    {teamMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name} ({roleLabels[m.role] || m.role})</option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                disabled={savingDef}
                onClick={handleAddTabLocation}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-bold text-sm transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-100 dark:shadow-none"
              >
                {savingDef ? <Loader size={16} className="animate-spin" /> : <Plus size={16} />} Lokasyon Ekle
              </button>
            </div>

            {/* Lokasyonlar Listesi */}
            <div className="max-h-[350px] overflow-y-auto border border-gray-100 dark:border-slate-700 rounded-xl divide-y divide-gray-100 dark:divide-slate-700">
              {defTabLocs.length === 0 ? (
                <div className="p-8 text-center text-xs text-gray-400 italic">Tanımlı lokasyon bulunamadı.</div>
              ) : (
                defTabLocs.map((loc) => {
                  const isBusiness = clientNames.some(
                    cName => cName && loc.label && cName.trim().toLowerCase() === loc.label.trim().toLowerCase()
                  );
                  return (
                    <div key={loc.id} className="p-3.5 flex justify-between items-center bg-gray-50/50 dark:bg-slate-900/10 hover:bg-gray-100/50 dark:hover:bg-slate-800/50 transition group">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{loc.label}</span>
                          {isBusiness && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                              İşletme
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                          <User size={10} /> Sahibi: {loc.user?.full_name || 'Bilinmeyen'}
                        </div>
                      </div>
                      {!isBusiness && (
                        <button
                          onClick={() => handleDeleteTabDefinition(loc.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                          title="Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assign Personnel Modal */}
      {showAssignModal && selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-blue-600 text-white">
              <div>
                <h2 className="text-lg font-bold">Personel Ata</h2>
                <p className="text-xs opacity-80">{selectedClient.name}</p>
              </div>
              <button onClick={() => setShowAssignModal(false)} className="hover:rotate-90 transition-transform">
                <Plus size={24} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-gray-500 mb-4">Bu işletmeden sorumlu olacak personelleri seçin:</p>
              <div className="space-y-2">
                {teamMembers.map(member => (
                  <label key={member.id} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 cursor-pointer transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                        {member.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold">{member.full_name}</p>
                        <p className="text-[10px] text-gray-400">{member.email}</p>
                      </div>
                    </div>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      checked={currentAssignments.includes(member.id)}
                      onChange={() => handleToggleAssign(member.id)}
                    />
                  </label>
                ))}
                {teamMembers.length === 0 && (
                  <p className="text-center text-gray-400 py-4 italic">Henüz ekip üyesi bulunmuyor.</p>
                )}
              </div>
            </div>
            <div className="p-4 bg-gray-50 dark:bg-slate-900 border-t flex justify-end">
              <button 
                onClick={() => setShowAssignModal(false)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 transition"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Client Modal */}
      {showAddClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">Yeni İşletme Ekle</h2>
              <button onClick={() => setShowAddClient(false)} className="text-gray-400 hover:text-gray-600">
                X
              </button>
            </div>
            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={newClient.name}
                  onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vergi No</label>
                <input
                  type="text"
                  value={newClient.tax_no}
                  onChange={(e) => setNewClient({ ...newClient, tax_no: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Adres</label>
                <textarea
                  value={newClient.address}
                  onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input
                  type="text"
                  value={newClient.phone}
                  onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firma Logosu (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  {newClient.logo_url ? (
                    <div className="relative">
                      <img src={newClient.logo_url} alt="Önizleme" className="w-16 h-16 rounded border object-contain bg-gray-50" />
                      <button 
                        type="button"
                        onClick={() => setNewClient({...newClient, logo_url: ''})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition">
                      <Upload className="text-gray-400 mb-2" size={24} />
                      <span className="text-xs text-gray-500">{uploadingLogo ? 'Yükleniyor...' : 'Bilgisayardan Seç'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
                    </label>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddClient(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {showEditClient && editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="p-6 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">İşletme Bilgilerini Düzenle</h2>
              <button 
                onClick={() => {
                  setShowEditClient(false);
                  setEditingClient(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                X
              </button>
            </div>
            <form onSubmit={handleUpdateClient} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Ünvanı *</label>
                <input
                  type="text"
                  required
                  value={editingClient.name}
                  onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Vergi No</label>
                <input
                  type="text"
                  value={editingClient.tax_no || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, tax_no: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Adres</label>
                <textarea
                  value={editingClient.address || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, address: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700 h-20"
                ></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Telefon</label>
                <input
                  type="text"
                  value={editingClient.phone || ''}
                  onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })}
                  className="w-full border rounded-lg p-2 dark:bg-slate-900 dark:border-slate-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Firma Logosu (Opsiyonel)</label>
                <div className="flex items-center gap-4">
                  {editingClient.logo_url ? (
                    <div className="relative">
                      <img src={editingClient.logo_url} alt="Önizleme" className="w-16 h-16 rounded border object-contain bg-gray-50" />
                      <button 
                        type="button"
                        onClick={() => setEditingClient({...editingClient, logo_url: ''})}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition">
                      <span className="text-xs text-gray-500">{uploadingLogo ? 'Yükleniyor...' : 'Bilgisayardan Seç'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => handleLogoUpload(e, true)} disabled={uploadingLogo} />
                    </label>
                  )}
                </div>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditClient(false);
                    setEditingClient(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-gray-700"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
