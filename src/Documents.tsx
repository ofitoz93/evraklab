import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Archive,
  MapPin,
  User,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  X,
  Filter,
  Maximize,
  Lock,
  Crown,
  Layers,
  BellRing,
  Building,
  Share2,
  Send,
} from 'lucide-react';

export default function Documents() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<any[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [filterType, setFilterType] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const [uniqueTypes, setUniqueTypes] = useState<string[]>([]);
  const [uniqueLocs, setUniqueLocs] = useState<string[]>([]);
  const [uniqueUsers, setUniqueUsers] = useState<
    { id: string; name: string }[]
  >([]);

  const [stats, setStats] = useState({ total: 0, expired: 0, warning: 0 });

  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [selectedDocForArchive, setSelectedDocForArchive] = useState<any>(null);
  const [archivedList, setArchivedList] = useState<any[]>([]);

  const [renewModalOpen, setRenewModalOpen] = useState(false);
  const [selectedDocForRenew, setSelectedDocForRenew] = useState<any>(null);
  const [renewFile, setRenewFile] = useState<File | null>(null);
  const [renewDate, setRenewDate] = useState('');
  const [renewExpiry, setRenewExpiry] = useState('');
  const [renewDeadline, setRenewDeadline] = useState('');
  const [renewReminder, setRenewReminder] = useState(0);
  const [renewing, setRenewing] = useState(false);

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<any>(null);

  const [userId, setUserId] = useState('');
  const [userRole, setUserRole] = useState('');
  const [myPermissions, setMyPermissions] = useState<any>({});

  const [isPremium, setIsPremium] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<boolean>(false);

  // İletme State'leri
  const [forwardDoc, setForwardDoc] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [forwardTarget, setForwardTarget] = useState('general');
  const [forwardNote, setForwardNote] = useState('');
  const [sendingForward, setSendingForward] = useState(false);

  useEffect(() => {
    fetchDocuments();
    checkInvites();
  }, []);

  const checkInvites = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', session.user.id)
        .eq('type', 'invite');
      if (count && count > 0) setPendingInvite(true);
    }
  };

  useEffect(() => {
    let result = docs;
    if (searchTerm) {
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          d.uploader?.full_name
            ?.toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          (userRole === 'admin' &&
            d.organization?.name
              ?.toLowerCase()
              .includes(searchTerm.toLowerCase()))
      );
    }
    if (filterType)
      result = result.filter((d) => (d.type_def?.label || '-') === filterType);
    if (filterLoc)
      result = result.filter(
        (d) => (d.location_def?.label || '-') === filterLoc
      );
    if (filterUser) result = result.filter((d) => d.uploader_id === filterUser);

    setFilteredDocs(result);
    calculateStats(result);
  }, [searchTerm, filterType, filterLoc, filterUser, docs, userRole]);

  const fetchDocuments = async () => {
    setLoading(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select(
          'organization_id, role, permissions, organization:organizations(subscription_end_date), subscription_end_date'
        )
        .eq('id', session.user.id)
        .single();

      const role = profile?.role || 'normal';
      const myOrgId = profile?.organization_id;
      setUserRole(role);
      setMyPermissions(profile?.permissions || {});

      if (myOrgId) {
        const { data: members } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('organization_id', myOrgId)
          .neq('id', session.user.id);
        setTeamMembers(members || []);
      }

      let hasActivePremium = false;
      const now = new Date();

      if (profile.role === 'admin') {
        hasActivePremium = true;
      } else if (
        profile.organization?.subscription_end_date &&
        new Date(profile.organization.subscription_end_date) > now
      ) {
        hasActivePremium = true;
      } else if (
        profile.subscription_end_date &&
        new Date(profile.subscription_end_date) > now
      ) {
        hasActivePremium = true;
      }

      setIsPremium(hasActivePremium);

      let query = supabase
        .from('documents')
        .select(
          `*, type_def:user_definitions!type_def_id(label), location_def:user_definitions!location_def_id(label), uploader:profiles!uploader_id(full_name), organization:organizations(name)`
        )
        .eq('is_archived', false);

      if (role !== 'admin') {
        if (myOrgId) {
          query = query.or(
            `uploader_id.eq.${session.user.id},organization_id.eq.${myOrgId}`
          );
        } else {
          query = query.eq('uploader_id', session.user.id);
        }
      }

      const { data, error } = await query.order('application_deadline', {
        ascending: true,
        nullsFirst: false,
      });

      if (!error) {
        const isOwner = role === 'premium_corporate';
        const isChief = role === 'corporate_chief';
        const canViewTeam =
          isOwner || (isChief && profile?.permissions?.can_view_team_docs);
        const finalDocs = (data || []).filter((doc) => {
          if (role === 'admin') return true;
          const isMyDoc = doc.uploader_id === session.user.id;
          const isCorporateDoc = !!doc.organization_id;
          if (!isCorporateDoc) return isMyDoc;
          if (isCorporateDoc) {
            if (!myOrgId || doc.organization_id !== myOrgId) return false;
            if (isMyDoc) return true;
            if (canViewTeam) return true;
          }
          return false;
        });
        setDocs(finalDocs);
        extractFilterOptions(finalDocs);
      }
    }
    setLoading(false);
  };

  const extractFilterOptions = (data: any[]) => {
    const types = Array.from(
      new Set(data.map((d) => d.type_def?.label || '-'))
    );
    setUniqueTypes(types);
    const locs = Array.from(
      new Set(data.map((d) => d.location_def?.label || '-'))
    );
    setUniqueLocs(locs);
    const usersMap = new Map();
    data.forEach((d) => {
      if (d.uploader) usersMap.set(d.uploader_id, d.uploader.full_name);
    });
    setUniqueUsers(
      Array.from(usersMap.entries()).map(([id, name]) => ({ id, name }))
    );
  };

  const calculateStats = (documents: any[]) => {
    let expired = 0;
    let warning = 0;
    documents.forEach((d) => {
      const targetDate = d.application_deadline;
      if (!d.is_indefinite && targetDate) {
        const days = getDaysLeft(targetDate);
        if (days !== null) {
          if (days < 0) expired++;
          else if (days <= 30) warning++;
        }
      }
    });
    setStats({ total: documents.length, expired, warning });
  };

  const getDaysLeft = (targetDate: string) => {
    if (!targetDate) return null;
    const today = new Date();
    const target = new Date(targetDate);
    return Math.ceil(
      (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
  };

  const handleOpenArchive = async (doc: any) => {
    setSelectedDocForArchive(doc);
    setArchiveModalOpen(true);
    let query = supabase
      .from('documents')
      .select(`*, uploader:profiles!uploader_id(full_name)`)
      .eq('is_archived', true)
      .eq('type_def_id', doc.type_def_id);
    if (doc.location_def_id)
      query = query.eq('location_def_id', doc.location_def_id);
    else query = query.is('location_def_id', null);
    if (doc.organization_id)
      query = query.eq('organization_id', doc.organization_id);
    else query = query.eq('uploader_id', doc.uploader_id);
    const { data } = await query.order('created_at', { ascending: false });
    setArchivedList(data || []);
  };

  const handleDelete = async (id: string, isSoft = false) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    await supabase.from('documents').delete().eq('id', id);
    if (isSoft) setArchivedList((prev) => prev.filter((d) => d.id !== id));
    else fetchDocuments();
  };

  const handleEditArchive = (docId: string) => {
    if (
      !window.confirm('Arşivlenmiş bir belgeyi düzenlemek üzeresiniz. Devam?')
    )
      return;
    navigate(`/documents/edit/${docId}`);
  };

  const handleOpenRenew = (doc: any) => {
    setSelectedDocForRenew(doc);
    setRenewDate('');
    setRenewExpiry('');
    setRenewDeadline('');
    setRenewReminder(doc.reminder_days || 0);
    setRenewFile(null);
    setRenewModalOpen(true);
  };

  // --- DÜZELTİLEN YENİLEME (RENEW) FONKSİYONU ---
  const handleRenewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renewFile && !renewDate) return alert('Tarih zorunlu.');
    setRenewing(true);
    try {
      // 1. Eski belgeyi arşivle
      await supabase
        .from('documents')
        .update({ is_archived: true })
        .eq('id', selectedDocForRenew.id);

      // 2. Dosya yükleme (varsa)
      let publicUrl = null;
      let fileExt = null;
      if (renewFile) {
        fileExt = renewFile.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const folder = selectedDocForRenew.organization_id || userId;
        const filePath = `${folder}/${fileName}`;
        await supabase.storage.from('documents').upload(filePath, renewFile);
        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      }

      // --- TEMİZLİK KISMI: Fazlalık ilişkisel verileri siliyoruz ---
      // Seçilen belgeden verileri kopyala
      const docData = { ...selectedDocForRenew };

      // SİLİNECEK ALANLAR (Database'de kolon olarak olmayanlar veya yeni ID alması gerekenler)
      delete docData.id;
      delete docData.created_at;
      delete docData.type_def; // <-- Hata veren kısım buydu
      delete docData.location_def; // <-- Hata veren kısım buydu
      delete docData.uploader;
      delete docData.organization;

      // Yeni değerleri ata
      docData.title = renewFile ? renewFile.name : selectedDocForRenew.title;
      docData.acquisition_date = renewDate;
      docData.expiry_date = selectedDocForRenew.is_indefinite
        ? null
        : renewExpiry;
      docData.application_deadline = selectedDocForRenew.is_indefinite
        ? null
        : renewDeadline;
      docData.reminder_days = renewReminder;
      docData.file_url = publicUrl || selectedDocForRenew.file_url;
      docData.file_type = fileExt || selectedDocForRenew.file_type;
      docData.is_archived = false;
      docData.uploader_id = userId;

      // 3. Yeni belgeyi oluştur
      const { error } = await supabase.from('documents').insert([docData]);

      if (error) throw error;
      alert('Belge güncellendi!');
      setRenewModalOpen(false);
      fetchDocuments();
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setRenewing(false);
    }
  };

  const handlePreview = (doc: any) => {
    setPreviewDoc(doc);
    setPreviewModalOpen(true);
  };

  const handleForwardDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forwardDoc) return;
    setSendingForward(true);
    const receiverId = forwardTarget === 'general' ? null : forwardTarget;
    const messageText =
      forwardNote.trim() ||
      `Lütfen bu evrağın durumunu kontrol edin: ${forwardDoc.title}`;
    try {
      await supabase.from('company_messages').insert([
        {
          organization_id: forwardDoc.organization_id,
          sender_id: userId,
          receiver_id: receiverId,
          message: messageText,
          document_id: forwardDoc.id,
          document_title: forwardDoc.title,
        },
      ]);
      alert('Belge başarıyla iletildi!');
      setForwardDoc(null);
      setForwardNote('');
      setForwardTarget('general');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setSendingForward(false);
    }
  };

  const canForward = (doc: any) => {
    if (!doc.organization_id) return false;
    if (
      userRole === 'admin' ||
      userRole === 'premium_corporate' ||
      userRole === 'corporate_chief'
    )
      return true;
    return false;
  };

  const limit = isPremium ? filteredDocs.length : 5;
  const displayedDocs = filteredDocs.slice(0, limit);
  const hiddenCount = Math.max(0, filteredDocs.length - limit);

  if (loading) return <div className="p-8 text-center">Yükleniyor...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {pendingInvite && (
        <div className="bg-indigo-600 text-white p-4 rounded-xl shadow-lg flex justify-between items-center animate-fadeIn">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <BellRing size={24} className="animate-bounce" />
            </div>
            <div>
              <div className="font-bold text-lg">
                Bekleyen Şirket Davetiniz Var!
              </div>
              <div className="text-indigo-100 text-sm">
                Bir şirket sizi ekibine dahil etmek istiyor.
              </div>
            </div>
          </div>
          <Link
            to="/notifications"
            className="bg-white text-indigo-700 px-6 py-2 rounded-lg font-bold hover:bg-indigo-50 transition"
          >
            Görüntüle
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-gray-500 text-xs font-bold uppercase">
              Toplam Belge
            </div>
            <div className="text-2xl font-bold text-blue-600">
              {stats.total}
            </div>
          </div>
          <FileText className="text-blue-200" size={32} />
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-gray-500 text-xs font-bold uppercase">
              Süresi Geçen
            </div>
            <div className="text-2xl font-bold text-red-600">
              {stats.expired}
            </div>
          </div>
          <AlertCircle className="text-red-200" size={32} />
        </div>
        <div className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-gray-500 text-xs font-bold uppercase">
              Yaklaşan (30 Gün)
            </div>
            <div className="text-2xl font-bold text-orange-500">
              {stats.warning}
            </div>
          </div>
          <Clock className="text-orange-200" size={32} />
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-center mt-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            Evrak Listesi
          </h1>
        </div>
        <Link
          to="/documents/add"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Yeni Belge Ekle
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl shadow-sm border space-y-3">
        <div className="flex items-center gap-2 border-b pb-2 mb-2 text-gray-500 font-bold text-sm">
          <Filter size={16} /> Filtreleme Seçenekleri
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded border">
            <Search className="text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Ara..."
              className="bg-transparent outline-none text-sm w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="bg-gray-50 border px-3 py-2 rounded text-sm outline-none"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Tüm Türler</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            className="bg-gray-50 border px-3 py-2 rounded text-sm outline-none"
            value={filterLoc}
            onChange={(e) => setFilterLoc(e.target.value)}
          >
            <option value="">Tüm Lokasyonlar</option>
            {uniqueLocs.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
          {(userRole === 'premium_corporate' ||
            userRole === 'admin' ||
            userRole === 'corporate_chief') && (
            <select
              className="bg-gray-50 border px-3 py-2 rounded text-sm outline-none font-bold text-blue-800"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            >
              <option value="">Tüm Personel</option>
              {uniqueUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        {filteredDocs.length === 0 ? (
          <div className="p-10 text-center text-gray-400">
            Belge bulunamadı.
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b text-gray-500 text-xs uppercase">
              <tr>
                <th className="p-4">Belge Türü</th>
                <th className="p-4">Lokasyon</th>
                <th className="p-4">Durum (Son Başvuru)</th>
                <th className="p-4 text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y">
              {displayedDocs.map((doc) => {
                const daysLeft = getDaysLeft(doc.application_deadline);
                const isCorporate = !!doc.organization_id;
                const isOwner = doc.uploader_id === userId;
                const canEdit =
                  isOwner ||
                  userRole === 'admin' ||
                  (userRole === 'premium_corporate' && isCorporate) ||
                  (userRole === 'corporate_chief' &&
                    myPermissions?.can_edit_team_docs &&
                    isCorporate);

                let statusBadge;
                if (doc.is_indefinite)
                  statusBadge = (
                    <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1 w-fit">
                      <CheckCircle size={10} /> SÜRESİZ
                    </span>
                  );
                else if (doc.application_deadline) {
                  if (daysLeft !== null && daysLeft < 0)
                    statusBadge = (
                      <span className="text-red-600 font-bold text-xs bg-red-50 px-2 py-1 rounded border border-red-200 flex items-center gap-1 w-fit">
                        <AlertCircle size={10} /> SÜRESİ GEÇTİ (
                        {Math.abs(daysLeft)} GÜN)
                      </span>
                    );
                  else if (daysLeft !== null && daysLeft <= 30)
                    statusBadge = (
                      <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded border border-orange-200 flex items-center gap-1 w-fit">
                        <Clock size={10} /> KRİTİK ({daysLeft} GÜN)
                      </span>
                    );
                  else
                    statusBadge = (
                      <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1 w-fit">
                        <CheckCircle size={10} /> GÜNCEL ({daysLeft} GÜN)
                      </span>
                    );
                } else
                  statusBadge = (
                    <span className="text-gray-400 text-xs">-</span>
                  );

                return (
                  <tr
                    key={doc.id}
                    className="hover:bg-gray-50 transition group"
                  >
                    <td className="p-4">
                      <div className="font-bold text-blue-700 uppercase mb-1">
                        {doc.type_def?.label || 'Genel'}
                      </div>
                      <div className="text-gray-700 font-semibold text-xs flex items-center gap-1">
                        <FileText size={12} className="text-gray-400" />{' '}
                        {doc.title}
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${
                            isCorporate
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-purple-50 text-purple-700'
                          }`}
                        >
                          {isCorporate ? 'KURUMSAL' : 'ŞAHSİ'}
                        </span>

                        {userRole === 'admin' &&
                          isCorporate &&
                          doc.organization && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1">
                              <Building size={10} /> {doc.organization.name}
                            </span>
                          )}

                        <span className="text-[10px] text-gray-500 font-bold flex items-center gap-1">
                          <User size={10} /> {doc.uploader?.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-700 font-bold flex items-center gap-1 bg-gray-100 px-2 py-1 rounded w-fit">
                        <MapPin size={12} /> {doc.location_def?.label || '-'}
                      </div>
                    </td>
                    <td className="p-4">
                      {statusBadge}
                      {doc.application_deadline && (
                        <div className="text-[10px] text-gray-400 mt-1">
                          Son Başvuru:{' '}
                          {new Date(
                            doc.application_deadline
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {/* İLET BUTONU */}
                        {canForward(doc) && (
                          <button
                            onClick={() => setForwardDoc(doc)}
                            className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 border border-purple-200 rounded transition"
                            title="Personele İlet / Sor"
                          >
                            <Share2 size={16} />
                          </button>
                        )}

                        <button
                          onClick={() => handleOpenArchive(doc)}
                          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition"
                          title="Arşiv"
                        >
                          <Archive size={16} />
                        </button>
                        <button
                          onClick={() => handlePreview(doc)}
                          className="p-2 bg-gray-100 hover:bg-blue-100 text-blue-600 rounded transition"
                          title="Önizle"
                        >
                          <Eye size={16} />
                        </button>
                        {canEdit && (
                          <button
                            onClick={() => handleOpenRenew(doc)}
                            className="p-2 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded transition"
                            title="Yenile"
                          >
                            <RefreshCw size={16} />
                          </button>
                        )}
                        {canEdit && (
                          <Link
                            to={`/documents/edit/${doc.id}`}
                            className="p-2 bg-gray-100 hover:bg-yellow-100 text-yellow-600 rounded transition"
                            title="Düzenle"
                          >
                            <Edit size={16} />
                          </Link>
                        )}
                        {canEdit && (
                          <button
                            onClick={() => handleDelete(doc.id)}
                            className="p-2 bg-gray-100 hover:bg-red-100 text-red-600 rounded transition"
                            title="Sil"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {hiddenCount > 0 && (
                <tr className="bg-gray-50 relative">
                  <td colSpan={4} className="p-0">
                    <div className="relative h-24 overflow-hidden">
                      <div className="absolute inset-0 flex flex-col justify-center gap-4 p-4 opacity-30 filter blur-sm select-none pointer-events-none">
                        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                        <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                      </div>
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 z-10 backdrop-blur-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Layers className="text-gray-400" />
                          <span className="text-gray-700 font-bold text-sm">
                            {hiddenCount} adet belge gizlendi.
                          </span>
                        </div>
                        <Link
                          to="/pricing"
                          className="bg-gradient-to-r from-gray-900 to-gray-700 text-white px-6 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg hover:scale-105 transition"
                        >
                          <Lock size={12} />{' '}
                          <Crown size={12} className="text-yellow-400" /> Tümünü
                          Görmek İçin Premium'a Geç
                        </Link>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {archiveModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="font-bold text-lg">Arşiv</h3>
              <button onClick={() => setArchiveModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {archivedList.length === 0 ? (
                <p className="text-center text-gray-400">Arşiv boş.</p>
              ) : (
                <table className="w-full text-left text-sm divide-y">
                  <thead>
                    <tr>
                      <th>Versiyon</th>
                      <th>Tarih</th>
                      <th className="text-right">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedList.map((arc) => (
                      <tr key={arc.id}>
                        <td className="p-3 font-bold">{arc.title}</td>
                        <td className="p-3 text-gray-500">
                          {new Date(arc.created_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right flex justify-end gap-2">
                          <button
                            onClick={() => handlePreview(arc)}
                            className="text-blue-600 font-bold"
                          >
                            Gör
                          </button>
                          <button
                            onClick={() => handleEditArchive(arc.id)}
                            className="text-yellow-600 font-bold"
                          >
                            Düzenle
                          </button>
                          <button
                            onClick={() => handleDelete(arc.id, true)}
                            className="text-red-500"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
      {renewModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            <div className="p-4 border-b flex justify-between bg-green-50 rounded-t-xl">
              <h3 className="font-bold text-green-800">Yenile</h3>
              <button onClick={() => setRenewModalOpen(false)}>
                <X />
              </button>
            </div>
            <form onSubmit={handleRenewSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold mb-1">
                  Yeni Alınma Tarihi
                </label>
                <input
                  type="date"
                  required
                  className="w-full border p-2 rounded"
                  value={renewDate}
                  onChange={(e) => setRenewDate(e.target.value)}
                />
              </div>
              {!selectedDocForRenew?.is_indefinite && (
                <>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Yeni Bitiş Tarihi
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full border p-2 rounded"
                      value={renewExpiry}
                      onChange={(e) => setRenewExpiry(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Yeni Son Başvuru
                    </label>
                    <input
                      type="date"
                      required
                      className="w-full border p-2 rounded"
                      value={renewDeadline}
                      onChange={(e) => setRenewDeadline(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1">
                      Hatırlatma (Gün)
                    </label>
                    <input
                      type="number"
                      className="w-full border p-2 rounded"
                      value={renewReminder}
                      onChange={(e) =>
                        setRenewReminder(parseInt(e.target.value))
                      }
                    />
                  </div>
                </>
              )}
              <div className="border-2 border-dashed rounded p-4 text-center">
                <input
                  type="file"
                  className="w-full"
                  onChange={(e) =>
                    setRenewFile(e.target.files ? e.target.files[0] : null)
                  }
                />
              </div>
              <button
                disabled={renewing}
                className="w-full bg-green-600 text-white py-2 rounded font-bold"
              >
                {renewing ? '...' : 'Güncelle'}
              </button>
            </form>
          </div>
        </div>
      )}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col relative">
            <button
              onClick={() => setPreviewModalOpen(false)}
              className="absolute -top-4 -right-4 bg-red-600 text-white p-2 rounded-full shadow-lg"
            >
              <X size={24} />
            </button>
            <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden">
              <iframe
                src={previewDoc?.file_url}
                className="w-full h-full"
                title="Önizleme"
              ></iframe>
            </div>
            <div className="p-4 bg-white flex justify-between items-center rounded-b-xl">
              <div className="font-bold">{previewDoc?.title}</div>
              <a
                href={previewDoc?.file_url}
                target="_blank"
                rel="noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                <Maximize size={16} /> Tam Ekran
              </a>
            </div>
          </div>
        </div>
      )}

      {/* --- İLETME MODALI --- */}
      {forwardDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Share2 className="text-purple-600" /> Belgeyi İlet
              </h3>
              <button onClick={() => setForwardDoc(null)}>
                <X className="text-gray-400 hover:text-red-500" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
              <div className="text-xs font-bold text-blue-500 uppercase mb-1">
                Seçilen Belge
              </div>
              <div className="font-bold text-gray-800">{forwardDoc.title}</div>
            </div>

            <form onSubmit={handleForwardDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Kime Gönderilecek?
                </label>
                <select
                  className="w-full p-3 rounded-lg border bg-white outline-none focus:ring-2 focus:ring-purple-500"
                  value={forwardTarget}
                  onChange={(e) => setForwardTarget(e.target.value)}
                >
                  <option value="general">📢 Genel Sohbet (Tüm Ekip)</option>
                  <optgroup label="Özel Mesaj (Personel)">
                    {teamMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.full_name}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Notunuz (İsteğe Bağlı)
                </label>
                <textarea
                  rows={3}
                  className="w-full p-3 rounded-lg border outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  placeholder="Örn: Bu evrağın yenilenmesi gerekiyor, durum nedir?"
                  value={forwardNote}
                  onChange={(e) => setForwardNote(e.target.value)}
                ></textarea>
              </div>

              <button
                disabled={sendingForward}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition"
              >
                {sendingForward ? (
                  'Gönderiliyor...'
                ) : (
                  <>
                    <Send size={18} /> Gönder
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
