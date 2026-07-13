import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
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
  BellRing,
  Building,
  Share2,
  Send,
  Upload,
  PenLine,
  Download,
} from 'lucide-react';

export default function Documents() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [docs, setDocs] = useState<any[]>([]);
  const [filteredDocs, setFilteredDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [filterType, setFilterType] = useState('');
  const [filterLoc, setFilterLoc] = useState('');
  const [filterUser, setFilterUser] = useState('');
  // 'all' = kurumsal + şahsi birlikte, 'mine' = sadece şahsi (organization_id boş
  // olan kendi yüklediklerim), 'org' = sadece kurumsal (organization_id dolu)
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine' | 'org'>('all');

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
  // Kullanıcının consultant_assignments üzerinden atandığı müşteri/firma adları
  // (küçük harf, trim'lenmiş) - atanmış personelin o firmanın belgelerini
  // otomatik görüntüleyip düzenleyebilmesi/yenileyebilmesi için kullanılır.
  const [assignedClientNamesState, setAssignedClientNamesState] = useState<string[]>([]);

  const [isPremium, setIsPremium] = useState(false);
  const [isEnvConsultant, setIsEnvConsultant] = useState(false);
  const [pendingInvite, setPendingInvite] = useState<boolean>(false);

  // İletme State'leri
  const [forwardDoc, setForwardDoc] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [forwardTarget, setForwardTarget] = useState('general');
  const [forwardNote, setForwardNote] = useState('');
  const [sendingForward, setSendingForward] = useState(false);

  // Islak İmza State'leri
  const [wetSigModalOpen, setWetSigModalOpen] = useState(false);
  const [selectedDocForWetSig, setSelectedDocForWetSig] = useState<any>(null);
  const [uploadingWetSig, setUploadingWetSig] = useState(false);

  // Required documents states
  const [requiredDocs, setRequiredDocs] = useState<any[]>([]);
  const [allClients, setAllClients] = useState<any[]>([]);
  const [allDocTypes, setAllDocTypes] = useState<any[]>([]);

  // Exemption Modal State
  const [exemptModalOpen, setExemptModalOpen] = useState(false);
  const [selectedReqDocForExempt, setSelectedReqDocForExempt] = useState<any>(null);
  const [exemptReason, setExemptReason] = useState('');
  const [savingExempt, setSavingExempt] = useState(false);
  const [orgSettings, setOrgSettings] = useState<any>(null);

const getOrCreateDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentFolderId: string
): Promise<string> => {
  const escapedName = folderName.replace(/'/g, "\\'");
  const query = `name='${escapedName}' and mimeType='application/vnd.google-apps.folder' and '${parentFolderId}' in parents and trashed = false`;
  const searchUrl = `https://www.googleapis.com/drive/v3/files?` + new URLSearchParams({
    q: query,
    fields: 'files(id, name)',
    spaces: 'drive',
  }).toString();

  const searchRes = await fetch(searchUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!searchRes.ok) {
    const errText = await searchRes.text();
    throw new Error('Google Drive klasör araması başarısız: ' + errText);
  }

  const searchData = await searchRes.json();
  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentFolderId],
    }),
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error('Google Drive alt klasörü oluşturulamadı: ' + errText);
  }

  const createData = await createRes.json();
  return createData.id;
};

// Drive'a yüklenen dosyalar varsayılan olarak sadece bağlanan Google hesabına
// özeldir; şirketteki diğer personel farklı (veya hiç) Google hesabıyla
// bağlantıyı açtığında "Bu sayfaya erişim izniniz yok" hatası alır. Bu yüzden
// her yükleme sonrası dosyaya "bağlantıya sahip olan herkes görüntüleyebilir"
// izni ekleniyor (best-effort; başarısız olursa yükleme geri alınmaz).
const makeDriveFileViewableByLink = async (accessToken: string, fileId: string) => {
  try {
    await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    });
  } catch (err) {
    console.error('Google Drive dosya izni ayarlanamadı:', err);
  }
};

  const fetchOnlyRequiredDocs = async () => {
    try {
      const { data: reqDocsData } = await supabase
        .from('client_required_documents')
        .select('*');
      setRequiredDocs(reqDocsData || []);
    } catch (err) {
      console.error('Error reloading required docs:', err);
    }
  };

  const handleOpenExemptModal = (reqDoc: any) => {
    setSelectedReqDocForExempt(reqDoc);
    setExemptReason(reqDoc.exempt_reason || '');
    setExemptModalOpen(true);
  };

  const handleSaveExemption = async () => {
    if (!selectedReqDocForExempt) return;
    setSavingExempt(true);
    try {
      const { error } = await supabase
        .from('client_required_documents')
        .update({
          is_exempt: true,
          exempt_reason: exemptReason.trim()
        })
        .eq('id', selectedReqDocForExempt.id);
      if (error) throw error;
      await fetchOnlyRequiredDocs();
      setExemptModalOpen(false);
    } catch (err: any) {
      alert('Muafiyet kaydedilirken hata: ' + err.message);
    } finally {
      setSavingExempt(false);
    }
  };

  const handleRemoveExemption = async (reqDoc: any) => {
    if (!window.confirm('Bu belgenin muafiyetini kaldırmak istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('client_required_documents')
        .update({
          is_exempt: false,
          exempt_reason: null
        })
        .eq('id', reqDoc.id);
      if (error) throw error;
      await fetchOnlyRequiredDocs();
    } catch (err: any) {
      alert('Muafiyet kaldırılırken hata: ' + err.message);
    }
  };

  useEffect(() => {
    fetchDocuments();
    checkInvites();
  }, []);

  // AddDocument.tsx'te aynı firma/tür için zaten aktif bir belge bulunduğunda,
  // kullanıcı "yenilemek ister misiniz?" sorusuna evet derse buraya
  // ?renew=<docId> ile yönlendiriliyor - o belgenin Yenile modalını otomatik açar.
  useEffect(() => {
    const renewId = searchParams.get('renew');
    if (renewId && docs.length > 0) {
      const target = docs.find((d) => d.id === renewId);
      if (target) {
        handleOpenRenew(target);
      }
      searchParams.delete('renew');
      setSearchParams(searchParams, { replace: true });
    }
  }, [docs]);

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
    if (scopeFilter === 'mine')
      result = result.filter((d) => !d.organization_id && d.uploader_id === userId);
    else if (scopeFilter === 'org')
      result = result.filter((d) => !!d.organization_id);

    setFilteredDocs(result);
    calculateStats(result);
  }, [searchTerm, filterType, filterLoc, filterUser, scopeFilter, docs, userRole, userId]);

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
          'organization_id, role, permissions, extra_permissions, organization:organizations(subscription_end_date, is_environmental_consultant), subscription_end_date'
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

        const { data: orgSettingsData } = await supabase
          .from('organizations')
          .select('storage_preference, google_client_id, google_client_secret, google_drive_folder_id, google_drive_refresh_token')
          .eq('id', myOrgId)
          .single();
        setOrgSettings(orgSettingsData);

        // Fetch client, required docs and all doc types for matrix matching
        try {
          const { data: clientsData } = await supabase
            .from('consultant_clients')
            .select('id, name')
            .eq('consultant_company_id', myOrgId);
          setAllClients(clientsData || []);

          const { data: reqDocsData } = await supabase
            .from('client_required_documents')
            .select('*');
          setRequiredDocs(reqDocsData || []);

          const { data: typesData } = await supabase
            .from('user_definitions')
            .select('id, label')
            .eq('category', 'doc_type')
            .eq('organization_id', myOrgId);
          setAllDocTypes(typesData || []);
        } catch (err) {
          console.error('Error fetching required docs config:', err);
        }
      }

      let hasActivePremium = false;
      const now = new Date();

      if (profile) {
        if (profile.role === 'admin') {
          hasActivePremium = true;
        } else if (
          (profile.organization as any)?.subscription_end_date &&
          new Date((profile.organization as any).subscription_end_date) > now
        ) {
          hasActivePremium = true;
        } else if (
          profile.subscription_end_date &&
          new Date(profile.subscription_end_date) > now
        ) {
          hasActivePremium = true;
        }
      }

      setIsPremium(hasActivePremium);
      setIsEnvConsultant(!!(profile?.organization as any)?.is_environmental_consultant);

      // Fetch assignments to restrict documents for chiefs/staff if they don't have can_view_all_clients
      let assignedClientNames: string[] = [];
      const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';
      const perms = profile?.extra_permissions || {};

      if (isRestrictedRole && !perms.can_view_all_clients) {
        const { data: assigns } = await supabase
          .from('consultant_assignments')
          .select('client:client_id(name)')
          .eq('user_id', session.user.id);
        assignedClientNames = assigns
          ?.map((a: any) => a.client?.name?.trim().toLowerCase())
          .filter(Boolean) || [];
      }
      setAssignedClientNamesState(assignedClientNames);

      let query = supabase
        .from('documents')
        .select(
          `*, type_def:user_definitions!type_def_id(label), location_def:user_definitions!location_def_id(label), uploader:profiles!uploader_id(full_name), organization:organizations!organization_id(name), env_report:env_reports(wet_signature_url, wet_signed_at)`
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
        const isPlainOrgMember = role === 'normal' && !!myOrgId;
        const canViewTeam =
          isOwner ||
          isPlainOrgMember ||
          (isChief && profile?.permissions?.can_view_team_docs) ||
          (isRestrictedRole && perms.can_view_all_clients);
        const finalDocs = (data || []).filter((doc) => {
          if (role === 'admin') return true;
          const isMyDoc = doc.uploader_id === session.user.id;
          const isCorporateDoc = !!doc.organization_id;
          if (!isCorporateDoc) return isMyDoc;
          if (isCorporateDoc) {
            if (!myOrgId || doc.organization_id !== myOrgId) return false;
            
            // Restrict visibility for chiefs/staff if they don't have can_view_all_clients
            if (isRestrictedRole && !perms.can_view_all_clients) {
              const docLocLabel = doc.location_def?.label?.trim().toLowerCase();
              const isAssigned = docLocLabel && assignedClientNames.includes(docLocLabel);
              return isMyDoc || isAssigned;
            }

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
      .select(`*, uploader:profiles!uploader_id(full_name), env_report:env_reports(wet_signature_url, wet_signed_at)`)
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
        
        if (selectedDocForRenew.organization_id && orgSettings && orgSettings.storage_preference === 'google_drive' && !orgSettings.google_drive_refresh_token) {
          throw new Error(
            'Şirketiniz Google Drive depolama kullanacak şekilde ayarlanmış ancak bağlantı henüz tamamlanmadı. ' +
            'Belge yükleyebilmek için lütfen sistem yöneticinizle iletişime geçip Google Drive bağlantısının tamamlanmasını isteyin.'
          );
        }

        if (selectedDocForRenew.organization_id && orgSettings && orgSettings.storage_preference === 'google_drive' && orgSettings.google_drive_refresh_token) {
          try {
            const tokenRes = await fetch('/api/google-oauth', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'refresh',
                client_id: orgSettings.google_client_id || '',
                client_secret: orgSettings.google_client_secret || '',
                refresh_token: orgSettings.google_drive_refresh_token || '',
              }),
            });

            if (!tokenRes.ok) throw new Error('Google access token yenilenemedi.');
            const result = await tokenRes.json();
            if (!result.success) throw new Error(result.error || 'Google access token yenilenemedi.');
            const accessToken = result.data.access_token;

            let clientFolderName = 'Genel';
            if (selectedDocForRenew.location_def && selectedDocForRenew.location_def.label) {
              clientFolderName = selectedDocForRenew.location_def.label.trim();
            }

            const parentFolderId = orgSettings.google_drive_folder_id || 'root';
            const targetFolderId = await getOrCreateDriveFolder(accessToken, clientFolderName, parentFolderId);

            const metadata = {
              name: `${Date.now()}-${renewFile.name}`,
              parents: [targetFolderId],
            };

            const form = new FormData();
            form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
            form.append('file', renewFile);

            const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              body: form,
            });

            if (!uploadRes.ok) {
              const errText = await uploadRes.text();
              throw new Error('Google Drive upload hatası: ' + errText);
            }

            const uploadData = await uploadRes.json();
            publicUrl = uploadData.webViewLink || `https://drive.google.com/file/d/${uploadData.id}/view`;
            await makeDriveFileViewableByLink(accessToken, uploadData.id);
          } catch (err: any) {
            throw new Error('Google Drive depolama hatası: ' + err.message);
          }
        } else {
          await supabase.storage.from('documents').upload(filePath, renewFile);
          const { data } = supabase.storage
            .from('documents')
            .getPublicUrl(filePath);
          publicUrl = data.publicUrl;
        }
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
      delete docData.env_report;

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

  const handleWetSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedDocForWetSig) return;
    setUploadingWetSig(true);
    try {
      const reportId = selectedDocForWetSig.env_report_id;
      const fileExt = file.name.split('.').pop();
      const filePath = `wet_signatures/report_${reportId}_signed_${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('client_assets')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('client_assets').getPublicUrl(filePath);
      const wetUrl = data.publicUrl;

      // Update env_reports
      const { error: updateError } = await supabase
        .from('env_reports')
        .update({
          wet_signature_url: wetUrl,
          wet_signed_at: new Date().toISOString()
        })
        .eq('id', reportId);

      if (updateError) throw updateError;

      setWetSigModalOpen(false);
      setSelectedDocForWetSig(null);
      alert('Islak imzalı rapor başarıyla yüklendi!');
      fetchDocuments();
      if (selectedDocForArchive) {
        handleOpenArchive(selectedDocForArchive);
      }
    } catch (err: any) {
      alert('Yüklenirken hata oluştu: ' + err.message);
    } finally {
      setUploadingWetSig(false);
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

  const limit = isPremium ? filteredDocs.length : 3;

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
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/consultant/reports/add"
            className="bg-green-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-green-700 transition"
          >
            <FileText size={20} /> Yeni Rapor Oluştur
          </Link>
          <Link
            to="/documents/add"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} /> Yeni Belge Ekle
          </Link>
          {(userRole === 'admin' || isEnvConsultant || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'corporate_staff' || userRole === 'premium_individual') && (
            <Link
              to="/consultant/opinions/add"
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-purple-700 transition"
            >
              <PenLine size={20} /> Görüş
            </Link>
          )}
        </div>
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
        {docs.some((d) => !!d.organization_id) && (
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-gray-400 font-bold">Kapsam:</span>
            <div className="flex bg-gray-50 border rounded-lg p-1 gap-1">
              {[
                { key: 'all', label: 'Tümü' },
                { key: 'mine', label: 'Şahsi Evraklarım' },
                { key: 'org', label: 'Kurumsal Evraklar' },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => setScopeFilter(opt.key as 'all' | 'mine' | 'org')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition ${
                    scopeFilter === opt.key
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ZORUNLU / EKSİK BELGELER PANELİ */}
      {filterLoc && (
        (() => {
          const activeClient = allClients.find(
            (c) => c.name && filterLoc && c.name.trim().toLowerCase() === filterLoc.trim().toLowerCase()
          );

          if (!activeClient) return null;

          const clientReqs = requiredDocs.filter((rd) => rd.client_id === activeClient.id);

          if (clientReqs.length === 0) return null;

          return (
            <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 mb-6 space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-slate-700 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg">
                    <FileText size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">
                      Zorunlu / Eksik Belgeler Checklist - {filterLoc}
                    </h3>
                    <p className="text-[11px] text-gray-400">Bu işletme için tanımlanmış zorunlu belgelerin listesi ve güncel durumu</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {clientReqs.map((req) => {
                  const typeDef = allDocTypes.find((t) => t.id === req.type_def_id);
                  if (!typeDef) return null;

                  const reqLabel = typeDef?.label?.trim().toLowerCase();
                  const matchedDoc = docs.find(
                    (d) =>
                      d.type_def?.label &&
                      d.type_def.label.trim().toLowerCase() === reqLabel &&
                      d.location_def?.label &&
                      d.location_def.label.trim().toLowerCase() === filterLoc.trim().toLowerCase()
                  );

                  let status: 'uploaded' | 'exempt' | 'missing' = 'missing';
                  if (req.is_exempt) {
                    status = 'exempt';
                  } else if (matchedDoc) {
                    status = 'uploaded';
                  }

                  return (
                    <div
                      key={req.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition ${
                        status === 'uploaded'
                          ? 'bg-emerald-50/20 border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/40'
                          : status === 'exempt'
                          ? 'bg-blue-50/20 border-blue-100 dark:bg-blue-950/10 dark:border-blue-900/40'
                          : 'bg-rose-50/20 border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/40'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          {typeDef.label}
                        </span>
                        {status === 'uploaded' ? (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-450 rounded-full flex items-center gap-1">
                            ✓ Yüklendi
                          </span>
                        ) : status === 'exempt' ? (
                          <span
                            className="px-2 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-450 rounded-full flex items-center gap-1 cursor-help"
                            title={`Muafiyet Nedeni: ${req.exempt_reason || 'Belirtilmedi'}`}
                          >
                            ℹ Muaf
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-[9px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-450 rounded-full flex items-center gap-1">
                            ⚠ Eksik
                          </span>
                        )}
                      </div>

                      {status === 'exempt' && req.exempt_reason && (
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 p-2 rounded-lg italic">
                          "{req.exempt_reason}"
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-1 border-t border-gray-100 dark:border-slate-700/50 pt-2 text-[10px]">
                        {status === 'missing' && (
                          <>
                            <button
                              onClick={() =>
                                navigate(
                                  `/add-document?typeDefId=${req.type_def_id}&clientName=${encodeURIComponent(
                                    filterLoc
                                  )}`
                                )
                              }
                              className="text-rose-600 dark:text-rose-400 font-bold hover:underline"
                            >
                              Belge Ekle
                            </button>
                            <span className="text-gray-350">•</span>
                            <button
                              onClick={() => handleOpenExemptModal(req)}
                              className="text-gray-500 hover:text-blue-600 dark:text-gray-405 font-bold"
                            >
                              Muaf Yap
                            </button>
                          </>
                        )}
                        {status === 'exempt' && (
                          <button
                            onClick={() => handleRemoveExemption(req)}
                            className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
                          >
                            Muafiyeti Kaldır
                          </button>
                        )}
                        {status === 'uploaded' && matchedDoc && (
                          <button
                            onClick={() => {
                              setPreviewDoc(matchedDoc);
                              setPreviewModalOpen(true);
                            }}
                            className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline"
                          >
                            Belgeyi Önizle
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()
      )}

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
              {filteredDocs.map((doc, docIdx) => {
                const isLocked = docIdx >= limit;
                const daysLeft = getDaysLeft(doc.application_deadline);
                const isCorporate = !!doc.organization_id;
                const isOwner = doc.uploader_id === userId;
                const docLocLabelLower = doc.location_def?.label?.trim().toLowerCase();
                const isAssignedToDoc =
                  isCorporate &&
                  !!docLocLabelLower &&
                  assignedClientNamesState.includes(docLocLabelLower);
                const canEdit =
                  isOwner ||
                  userRole === 'admin' ||
                  (userRole === 'premium_corporate' && isCorporate) ||
                  (userRole === 'corporate_chief' &&
                    myPermissions?.can_edit_team_docs &&
                    isCorporate) ||
                  // Atanmış personel (consultant_assignments), atandığı firmanın
                  // belgelerini otomatik olarak görüntüleyebilir/düzenleyebilir/yenileyebilir.
                  ((userRole === 'corporate_staff' || userRole === 'corporate_chief') &&
                    isAssignedToDoc);
                const canDelete =
                  isOwner ||
                  userRole === 'admin' ||
                  (userRole === 'premium_corporate' && isCorporate) ||
                  (userRole === 'corporate_chief' && isCorporate) ||
                  // Silme varsayılan olarak sadece şef/sahip/admin'de - firma sahibi
                  // isterse bir personele bu yetkiyi ayrıca verebilir.
                  (userRole === 'corporate_staff' &&
                    isCorporate &&
                    !!myPermissions?.can_delete_team_docs);

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
                  else if (daysLeft !== null && daysLeft <= 30) {
                    const isMonthlyReport = doc.type_def?.label?.toLowerCase().includes('aylık') || doc.type_def?.label?.toLowerCase().includes('aylik');
                    if (isMonthlyReport) {
                      statusBadge = (
                        <span className="text-green-600 font-bold text-xs bg-green-50 px-2 py-1 rounded border border-green-200 flex items-center gap-1 w-fit">
                          <CheckCircle size={10} /> GÜNCEL ({daysLeft} GÜN)
                        </span>
                      );
                    } else {
                      statusBadge = (
                        <span className="text-orange-600 font-bold text-xs bg-orange-50 px-2 py-1 rounded border border-orange-200 flex items-center gap-1 w-fit">
                          <Clock size={10} /> KRİTİK ({daysLeft} GÜN)
                        </span>
                      );
                    }
                  }
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
                  <React.Fragment key={doc.id}>
                    {isLocked && docIdx === limit && (
                      <tr>
                        <td colSpan={4} className="p-0">
                          <div className="bg-gradient-to-r from-rose-600 to-orange-500 text-white p-3.5 flex flex-col sm:flex-row items-center justify-between gap-2.5">
                            <div className="flex items-center gap-2">
                              <Lock size={16} />
                              <span className="font-bold text-xs sm:text-sm">
                                Premium süresi doldu! Evrakları görüntülemek için yenileme yapın.
                              </span>
                            </div>
                            <Link
                              to="/pricing"
                              className="bg-white text-rose-700 px-4 py-1.5 rounded-full font-bold text-xs whitespace-nowrap hover:bg-rose-50 transition shrink-0"
                            >
                              Paketi Yenile
                            </Link>
                          </div>
                        </td>
                      </tr>
                    )}
                    <tr
                      className={`hover:bg-gray-50 transition group ${isLocked ? 'relative' : ''}`}
                    >
                    <td className={`p-4 ${isLocked ? 'blur-[4px] select-none pointer-events-none opacity-70' : ''}`}>
                      <div className="font-bold text-blue-700 uppercase mb-1">
                        {doc.type_def?.label || 'Genel'}
                      </div>
                      <div className="text-gray-700 font-semibold text-xs flex items-center gap-1.5 flex-wrap">
                        <FileText size={12} className="text-gray-400" />{' '}
                        <span>{doc.title}</span>
                        {doc.env_report?.wet_signature_url && (
                          <a
                            href={doc.env_report.wet_signature_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-0.5 hover:bg-emerald-200 transition"
                            title="Islak İmzalı Raporu Görüntüle"
                          >
                            <CheckCircle size={10} className="text-emerald-600" /> Islak İmzalı
                          </a>
                        )}
                      </div>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded border ${isCorporate
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
                    <td className={`p-4 ${isLocked ? 'blur-[4px] select-none pointer-events-none opacity-70' : ''}`}>
                      <div className="text-sm text-gray-700 font-bold flex items-center gap-1 bg-gray-100 px-2 py-1 rounded w-fit">
                        <MapPin size={12} /> {doc.location_def?.label || '-'}
                      </div>
                    </td>
                    <td className={`p-4 ${isLocked ? 'blur-[4px] select-none pointer-events-none opacity-70' : ''}`}>
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
                    <td className={`p-4 text-right ${isLocked ? 'blur-[4px] select-none pointer-events-none opacity-70' : ''}`}>
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

                        {doc.env_report_id && canEdit && (
                          <button
                            onClick={() => {
                              if (doc.env_report?.wet_signature_url) {
                                if (!window.confirm("Bu ay için ıslak imzalı rapor zaten yüklü. Güncellemek ister misiniz?")) {
                                  return;
                                }
                              }
                              setSelectedDocForWetSig(doc);
                              setWetSigModalOpen(true);
                            }}
                            className="p-2 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded transition"
                            title={doc.env_report?.wet_signature_url ? 'Islak İmzalı Raporu Değiştir' : 'Islak İmzalı Rapor Yükle'}
                          >
                            <PenLine size={16} />
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
                        {canDelete && (
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
                  </React.Fragment>
                );
              })}

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
                      <th className="p-3 text-left">Belge Adı</th>
                      <th className="p-3 text-left">Tarih</th>
                      <th className="p-3 text-right">İşlemler</th>
                    </tr>
                  </thead>
                  <tbody>
                    {archivedList.map((arc) => {
                      const isReport = !!arc.env_report_id;
                      const isWetSigned = !!arc.env_report?.wet_signature_url;
                      const arcIsCorporate = !!arc.organization_id;
                      // arc sorgusu location_def'i join'lemiyor ama zaten aynı
                      // location_def_id ile filtrelendiği için, açılışta seçilen
                      // aktif belgenin (selectedDocForArchive) lokasyon etiketi kullanılabilir.
                      const arcLocLabelLower = selectedDocForArchive?.location_def?.label?.trim().toLowerCase();
                      const canEditArc =
                        arc.uploader_id === userId ||
                        userRole === 'admin' ||
                        (userRole === 'premium_corporate' && arcIsCorporate) ||
                        (userRole === 'corporate_chief' &&
                          myPermissions?.can_edit_team_docs &&
                          arcIsCorporate) ||
                        ((userRole === 'corporate_staff' || userRole === 'corporate_chief') &&
                          arcIsCorporate &&
                          !!arcLocLabelLower &&
                          assignedClientNamesState.includes(arcLocLabelLower));
                      return (
                        <tr key={arc.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                          <td className="p-3">
                            <div className="font-bold text-gray-800 flex items-center gap-2">
                              {arc.title}
                              {isWetSigned && (
                                <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">
                                  [Islak İmzalı]
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-gray-500 text-xs">
                            {new Date(arc.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-right flex justify-end items-center gap-2">
                            {/* Görüntüleme & İndirme */}
                            {isReport ? (
                              <Link
                                to={`/consultant/reports/${arc.env_report_id}`}
                                onClick={() => setArchiveModalOpen(false)}
                                className="p-1.5 bg-green-50 hover:bg-green-100 text-green-600 border border-green-200 rounded transition"
                                title="Raporu Görüntüle ve PDF İndir"
                              >
                                <Eye size={14} />
                              </Link>
                            ) : arc.file_url ? (
                              <a
                                href={arc.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded transition flex items-center justify-center"
                                title="Dosyayı İndir"
                              >
                                <Download size={14} />
                              </a>
                            ) : (
                              <span
                                className="p-1.5 bg-gray-50 text-gray-300 border border-gray-150 rounded flex items-center justify-center dark:bg-slate-900 dark:text-slate-700 dark:border-slate-700"
                                title="Bu arşiv kaydına ait dosya bulunmuyor"
                              >
                                <Download size={14} />
                              </span>
                            )}

                            {/* Islak İmza Yükleme (Sadece Raporlar İçin) */}
                            {isReport && canEditArc && (
                              <button
                                onClick={() => {
                                  if (arc.env_report?.wet_signature_url) {
                                    if (!window.confirm("Bu ay için ıslak imzalı rapor zaten yüklü. Güncellemek ister misiniz?")) {
                                      return;
                                    }
                                  }
                                  setSelectedDocForWetSig(arc);
                                  setWetSigModalOpen(true);
                                }}
                                className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 border border-amber-200 rounded transition"
                                title={arc.env_report?.wet_signature_url ? 'Islak İmzalı Raporu Değiştir' : 'Islak İmzalı Rapor Yükle'}
                              >
                                <PenLine size={14} />
                              </button>
                            )}

                            {/* Düzeltme */}
                            <button
                              onClick={() => handleEditArchive(arc.id)}
                              className="p-1.5 bg-yellow-50 hover:bg-yellow-100 text-yellow-600 border border-yellow-200 rounded transition"
                              title="Belge Bilgilerini Düzenle"
                            >
                              <Edit size={14} />
                            </button>

                            {/* Sil */}
                            <button
                              onClick={() => handleDelete(arc.id, true)}
                              className="p-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded transition"
                              title="Sil"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
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
      {/* EXEMPTION MODAL */}
      {exemptModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 border border-gray-100 dark:border-slate-800 animate-scaleIn">
            <div className="flex justify-between items-center border-b border-gray-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-gray-800 dark:text-gray-150">Belge Muafiyeti Tanımla</h3>
              <button
                onClick={() => setExemptModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Lütfen bu belgenin bu işletme için neden muaf olduğunu belirten bir açıklama yazınız:
              </p>
              <textarea
                placeholder="Örn: İşletmenin tehlikeli atık üretimi bulunmadığı için Tehlikeli Atık Mali Sorumluluk Sigortası'ndan muaftır."
                value={exemptReason}
                onChange={(e) => setExemptReason(e.target.value)}
                className="w-full p-3 border rounded-xl bg-white dark:bg-slate-950 border-gray-200 dark:border-slate-800 text-xs outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 dark:text-white h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setExemptModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-50 dark:hover:bg-slate-850 rounded-lg transition"
              >
                Vazgeç
              </button>
              <button
                type="button"
                disabled={savingExempt || !exemptReason.trim()}
                onClick={handleSaveExemption}
                className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-lg transition flex items-center gap-1.5"
              >
                {savingExempt ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
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

            {/* Rapor bağlantılı belge: iframe yerine rapor önizlemesi */}
            {previewDoc?.env_report_id ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 p-8 bg-gradient-to-br from-green-50 to-emerald-50">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                  <FileText size={40} className="text-green-600" />
                </div>
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-800 mb-2">{previewDoc?.title}</h3>
                  <p className="text-sm text-gray-500 mb-1">
                    Bu belge sistem üzerinde hazırlanan bir çevre raporuna bağlıdır.
                  </p>
                  <p className="text-xs text-gray-400">Raporu görüntülemek, yazdırmak veya PDF olarak indirmek için aşağıdaki butona tıklayın.</p>
                </div>
                <div className="flex gap-3">
                  <Link
                    to={`/consultant/reports/${previewDoc.env_report_id}`}
                    onClick={() => setPreviewModalOpen(false)}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg transition"
                  >
                    <Eye size={20} /> Raporu Görüntüle ve PDF İndir
                  </Link>
                  <button
                    onClick={() => setPreviewModalOpen(false)}
                    className="border border-gray-300 text-gray-600 px-4 py-3 rounded-xl font-medium hover:bg-gray-50 transition"
                  >
                    Kapat
                  </button>
                </div>
              </div>
            ) : previewDoc?.file_url ? (
              <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden">
                <iframe
                  src={previewDoc?.file_url?.includes('drive.google.com') ? previewDoc.file_url.replace('/view', '/preview') : previewDoc?.file_url}
                  className="w-full h-full"
                  title="Önizleme"
                ></iframe>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 text-gray-400">
                <FileText size={48} />
                <p className="font-bold">Bu belge için dosya mevcut değil.</p>
              </div>
            )}

            <div className="p-4 bg-white flex justify-between items-center rounded-b-xl border-t">
              <div className="font-bold text-gray-700">{previewDoc?.title}</div>
              {!previewDoc?.env_report_id && previewDoc?.file_url && (
                <a
                  href={previewDoc?.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  <Maximize size={16} /> Tam Ekran
                </a>
              )}
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
      {/* Islak İmza Yükleme Modalı */}
      {wetSigModalOpen && selectedDocForWetSig && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <PenLine className="text-amber-600" /> Islak İmzalı Rapor Yükle
              </h3>
              <button onClick={() => { setWetSigModalOpen(false); setSelectedDocForWetSig(null); }}>
                <X size={20} className="text-gray-400 hover:text-red-500" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-700">
              <span className="font-bold">Seçilen Rapor:</span> {selectedDocForWetSig.title}
            </div>

            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
              <strong>Nasıl yapılır?</strong>
              <ol className="mt-2 space-y-1 list-decimal list-inside text-xs">
                <li>Raporu indirin veya "Görüntüle" sayfasından yazdırın</li>
                <li>İlgili kişilere ıslak imzalattırın</li>
                <li>İmzalı raporu taratıp/fotoğrafını çekip dijitalleştirin</li>
                <li>Aşağıdan seçerek yükleyin</li>
              </ol>
            </div>
            <label className={`w-full flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition ${uploadingWetSig ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-amber-300 bg-amber-50 hover:border-amber-500 hover:bg-amber-100'}`}>
              {uploadingWetSig ? (
                <>
                  <RefreshCw size={32} className="text-amber-500 animate-spin" />
                  <span className="font-bold text-amber-700">Yükleniyor...</span>
                </>
              ) : (
                <>
                  <Upload size={32} className="text-amber-500" />
                  <span className="font-bold text-gray-700">Islak İmzalı Dosyayı Seçin</span>
                  <span className="text-xs text-gray-400">PDF, JPG, PNG desteklenir</span>
                </>
              )}
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleWetSignatureUpload}
                disabled={uploadingWetSig}
              />
            </label>
          </div>
        </div>
      )}

    </div>
  );
}
