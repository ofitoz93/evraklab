import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Save,
  ArrowLeft,
  Crown,
  Lock,
  Settings,
  Plus,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';

export default function EditDocument() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState('');
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docScope, setDocScope] = useState<'personal' | 'corporate'>('personal');
  const [corporateClients, setCorporateClients] = useState<any[]>([]);

  // Listeler
  const [typeOptions, setTypeOptions] = useState<any[]>([]);
  const [locOptions, setLocOptions] = useState<any[]>([]);

  // State'ler
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState(''); // ID tutacak
  const [location, setLocation] = useState(''); // Şahside ID, Kurumsalda Ünvan tutacak
  const [desc, setDesc] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [appDeadline, setAppDeadline] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [reminderDays, setReminderDays] = useState(0);

  // Modal State'leri
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageCategory, setManageCategory] = useState<'doc_type' | 'location'>(
    'doc_type'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newDefLabel, setNewDefLabel] = useState('');

  const fetchCorporateClients = async (orgId: string, role: string, userId: string, perms?: any) => {
    try {
      let query = supabase.from('consultant_clients').select('id, name');
      
      const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';
      if (isRestrictedRole && !perms?.can_view_all_clients) {
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .eq('user_id', userId);
        const cIds = assignments?.map((a) => a.client_id) || [];
        if (cIds.length > 0) {
          query = query.in('id', cIds);
        } else {
          setCorporateClients([]);
          return;
        }
      } else {
        query = query.eq('consultant_company_id', orgId);
      }
      
      const { data } = await query.order('name', { ascending: true });
      setCorporateClients(data || []);
    } catch (err) {
      console.error('Corporate clients fetch error:', err);
    }
  };

  useEffect(() => {
    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await fetchDefinitions(session.user.id, docScope === 'corporate', myOrgId);
      }
    };
    run();
  }, [docScope, myOrgId]);

  useEffect(() => {
    fetchData();
  }, [id]);

  const fetchData = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    
    let currentRole = '';
    let currentOrgId: string | null = null;
    let currentPerms: any = null;
    
    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id, extra_permissions')
        .eq('id', session.user.id)
        .single();
      currentRole = profile?.role || 'normal';
      currentOrgId = profile?.organization_id || null;
      currentPerms = profile?.extra_permissions || null;
      
      setUserRole(currentRole);
      setMyOrgId(currentOrgId);
    }

    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();
      
    if (data) {
      setTitle(data.title);
      setDocType(data.type_def_id || '');
      setDesc(data.description || '');
      setAcquisitionDate(data.acquisition_date || '');
      setExpiryDate(data.expiry_date || '');
      setAppDeadline(data.application_deadline || '');
      setIsIndefinite(data.is_indefinite || false);
      setReminderDays(data.reminder_days || 0);
      
      const scope = data.organization_id ? 'corporate' : 'personal';
      setDocScope(scope);

      if (currentOrgId) {
        await fetchCorporateClients(currentOrgId, currentRole, session?.user.id || '', currentPerms);
      }

      await fetchDefinitions(session?.user.id || '', scope === 'corporate', currentOrgId);

      if (scope === 'corporate' && data.location_def_id) {
        const { data: def } = await supabase
          .from('user_definitions')
          .select('label')
          .eq('id', data.location_def_id)
          .single();
        if (def) {
          setLocation(def.label);
        } else {
          setLocation('');
        }
      } else {
        setLocation(data.location_def_id || '');
      }
    }
    setLoading(false);
  };

  const fetchDefinitions = async (userId: string, isCorporate = false, orgId: string | null = null) => {
    const targetOrgId = orgId || myOrgId;
    let query = supabase.from('user_definitions').select('*');
    if (isCorporate && targetOrgId) {
      query = query.eq('user_id', userId).eq('organization_id', targetOrgId);
    } else {
      query = query.eq('user_id', userId).is('organization_id', null);
    }
    const { data: defs, error: dErr } = await query.order('created_at', { ascending: true });
    if (dErr) {
      console.error('fetchDefinitions user_definitions fetch error:', dErr);
    }
    if (defs) {
      // Filter out duplicate names, prioritizing the current user's definition row
      const uniqueTypesMap = new Map<string, any>();
      defs.filter((d) => d.category === 'doc_type').forEach(d => {
        if (!d.label) return;
        const key = d.label.trim().toLowerCase();
        const existing = uniqueTypesMap.get(key);
        if (!existing || d.user_id === userId) {
          uniqueTypesMap.set(key, d);
        }
      });
      setTypeOptions(Array.from(uniqueTypesMap.values()));

      const uniqueLocsMap = new Map<string, any>();
      defs.filter((d) => d.category === 'location').forEach(d => {
        if (!d.label) return;
        const key = d.label.trim().toLowerCase();
        const existing = uniqueLocsMap.get(key);
        if (!existing || d.user_id === userId) {
          uniqueLocsMap.set(key, d);
        }
      });
      setLocOptions(Array.from(uniqueLocsMap.values()));
    }
  };

  // --- YENİ KONTROLLÜ EKLEME FONKSİYONU ---
  const handleAddDefinition = async () => {
    if (!newDefLabel.trim()) return;

    if (manageCategory === 'location') {
      const canCreateLoc = docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin';
      if (!canCreateLoc) {
        alert("Hata: Kurumsal dökümanlar için lokasyon ekleme yetkiniz yoktur. Sadece yönetici ve şefler tanımlamalar sayfasından ekleyebilir.");
        return;
      }
    }

    const normalizedLabel = newDefLabel.trim(); // Boşlukları al

    // 1. LİSTEDE VAR MI KONTROLÜ (Frontend Kontrolü)
    // Hangi listeye ekliyoruz? Tür mü Lokasyon mu?
    const currentList =
      manageCategory === 'doc_type' ? typeOptions : locOptions;

    // İsmi küçük harfe çevirip karşılaştır (Büyük/Küçük harf duyarlılığı olmasın)
    const exists = currentList.some(
      (item) => item.label && item.label.toLowerCase() === normalizedLabel.toLowerCase()
    );

    if (exists) {
      alert(`⛔ " ${normalizedLabel} " zaten listenizde mevcut!`);
      return; // İşlemi durdur
    }

    // 2. VERİTABANINA EKLEME
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase.from('user_definitions').insert([
      {
        user_id: session.user.id,
        category: manageCategory,
        label: normalizedLabel,
        organization_id: docScope === 'corporate' ? myOrgId : null,
      },
    ]);

    if (!error) {
      setNewDefLabel(''); // Kutuyu temizle
      fetchDefinitions(session.user.id, docScope === 'corporate', myOrgId); // Listeyi yenile
    } else {
      // Eğer SQL tarafındaki engel yakalarsa burası çalışır
      if (
        error.message.includes('unique constraint') ||
        error.code === '23505'
      ) {
        alert('Bu kayıt zaten veritabanında mevcut.');
      } else {
        alert('Hata: ' + error.message);
      }
    }
  };

  const handleDeleteDefinition = async (id: string) => {
    if (manageCategory === 'location') {
      const canCreateLoc = docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin';
      if (!canCreateLoc) {
        alert("Hata: Kurumsal dökümanlar için lokasyon silme yetkiniz yoktur. Sadece yönetici ve şefler tanımlamalar sayfasından yönetebilir.");
        return;
      }
    }

    const item = (manageCategory === 'doc_type' ? typeOptions : locOptions).find(o => o.id === id);
    if (item && manageCategory === 'location' && docScope === 'corporate') {
      const isBusiness = corporateClients.some(
        c => c?.name && item?.label && c.name.trim().toLowerCase() === item.label.trim().toLowerCase()
      );
      if (isBusiness) {
        alert('⛔ Kayıtlı bir işletmeye ait lokasyon silinemez!');
        return;
      }
    }

    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      if (docScope === 'corporate' && myOrgId && item) {
        const targetOrgId = myOrgId;
        const { data: orgProfiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', targetOrgId);
        const userIds = orgProfiles?.map(p => p.id) || [];
        
        await supabase
          .from('user_definitions')
          .delete()
          .in('user_id', userIds)
          .eq('category', manageCategory)
          .ilike('label', item.label);
      } else {
        await supabase.from('user_definitions').delete().eq('id', id);
      }
      fetchDefinitions(session.user.id, docScope === 'corporate', myOrgId);
    }
  };

  const startEditing = (id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
  };
  // --- KONTROLLÜ DÜZENLEME FONKSİYONU ---
  const saveEditing = async (id: string) => {
    if (!editValue.trim()) return;

    if (manageCategory === 'location') {
      const canCreateLoc = docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin';
      if (!canCreateLoc) {
        alert("Hata: Kurumsal dökümanlar için lokasyon düzenleme yetkiniz yoktur. Sadece yönetici ve şefler tanımlamalar sayfasından yönetebilir.");
        return;
      }
    }

    const normalizedLabel = editValue.trim();

    // 1. ÇAKIŞMA KONTROLÜ
    const currentList =
      manageCategory === 'doc_type' ? typeOptions : locOptions;

    // Kendisi hariç diğerlerinde bu isim var mı?
    const exists = currentList.some(
      (item) =>
        item.id !== id && // Kendisi değilse
        item.label.toLowerCase() === normalizedLabel.toLowerCase()
    );

    if (exists) {
      alert(`⛔ " ${normalizedLabel} " ismi zaten kullanımda!`);
      return;
    }

    // 2. GÜNCELLEME
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const { error } = await supabase
      .from('user_definitions')
      .update({ label: normalizedLabel })
      .eq('id', id);

    if (!error && session) {
      setEditingId(null);
      setEditValue('');
      fetchDefinitions(session.user.id, docScope === 'corporate', myOrgId);
    } else {
      if (error?.message.includes('unique')) {
        alert('Bu isimde başka bir kayıt var.');
      } else {
        alert('Güncelleme hatası.');
      }
    }
  };
  const openManageModal = (category: 'doc_type' | 'location') => {
    setManageCategory(category);
    setManageModalOpen(true);
  };

  const isPremium =
    userRole === 'premium_corporate' ||
    userRole === 'corporate_chief' ||
    userRole === 'premium_individual' ||
    userRole === 'admin';

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalDeadline = appDeadline ? appDeadline : expiryDate;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // LOKASYON KONTROLÜ (Ortak)
      let finalLocId = (location && location !== 'NEW_LOC') ? location : null;
      const manualLocName = (window as any).tempManualLoc;

      const canCreateLoc = docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin';
      if (location === 'NEW_LOC' && manualLocName && canCreateLoc) {
        const { data: newLoc } = await supabase
          .from('user_definitions')
          .insert([{ user_id: session.user.id, category: 'location', label: manualLocName }])
          .select()
          .single();
        if (newLoc) finalLocId = newLoc.id;
      }

      const selectedType = typeOptions.find(t => t.id === docType);
      const finalTitle = selectedType ? selectedType.label : title;

      const { error } = await supabase
        .from('documents')
        .update({
          title: finalTitle,
          description: desc,
          type_def_id: docType,
          location_def_id: finalLocId,
          acquisition_date: acquisitionDate,
          expiry_date: isIndefinite ? null : expiryDate,
          application_deadline: isIndefinite ? null : finalDeadline,
          is_indefinite: isIndefinite,
          reminder_days: isPremium ? reminderDays : 0,
        })
        .eq('id', id);

      if (!error) {
        alert('✅ Güncellendi!');
        navigate(`/documents/${id}`);
      } else {
        alert('Hata: ' + error.message);
      }
    } catch (err: any) {
      alert('Güncelleme sırasında hata oluştu: ' + err.message);
    }
  };

  if (loading) return <div>Yükleniyor...</div>;

  return (
    <div className="max-w-3xl mx-auto relative">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 mb-4 font-bold"
      >
        <ArrowLeft size={18} /> Vazgeç
      </button>
      <div className="bg-white p-8 rounded-xl shadow-lg border">
        <h2 className="text-2xl font-bold mb-6">Belge Düzenle</h2>
        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">

            <div>
              <label className="font-bold block mb-1 flex justify-between">
                Belge Türü
                {(docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin') && (
                  <button
                    type="button"
                    onClick={() => openManageModal('doc_type')}
                    className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                  >
                    <Settings size={12} /> Yönet
                  </button>
                )}
              </label>
              <select
                className="w-full p-2 border rounded bg-white"
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
              >
                <option value="">Seçiniz...</option>
                {/* Eğer listede yoksa (silindiyse) ama belgede kayıtlıysa ID'yi göster */}
                {docType && !typeOptions.find((t) => t.id === docType) && (
                  <option value={docType}>Eski Kayıt</option>
                )}
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1 flex justify-between">
              Lokasyon
              {(docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin') && (
                <button
                  type="button"
                  onClick={() => openManageModal('location')}
                  className="text-xs text-blue-600 flex items-center gap-1 hover:underline"
                >
                  <Settings size={12} /> Yönet
                </button>
              )}
            </label>
            <select
              className="w-full p-2 border rounded bg-white"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">Belirtilmemiş</option>
              {location && !locOptions.find((l) => l.id === location) && (
                <option value={location}>Eski Kayıt</option>
              )}
              {locOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
              {(docScope === 'personal' || userRole === 'premium_corporate' || userRole === 'corporate_chief' || userRole === 'admin') && (
                <option value="NEW_LOC">+ Yeni Lokasyon Ekle...</option>
              )}
            </select>
            {location === 'NEW_LOC' && (
              <input
                type="text"
                className="w-full mt-2 p-2 border rounded border-blue-300 bg-blue-50 text-sm font-bold"
                placeholder="Yeni lokasyon ismini yazın..."
                autoFocus
                onChange={(e) => (window as any).tempManualLoc = e.target.value}
              />
            )}
          </div>

          {/* TARİHLER (Aynısı) */}
          <div className="bg-gray-50 p-4 rounded border grid grid-cols-2 gap-4">
            <div className="col-span-2 flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                checked={isIndefinite}
                onChange={(e) => setIsIndefinite(e.target.checked)}
              />
              <span className="font-bold text-sm">Süresiz Belge</span>
            </div>
            <div>
              <label className="font-bold text-xs block mb-1">
                Alınma Tarihi
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                required
              />
            </div>
            {!isIndefinite && (
              <>
                <div>
                  <label className="font-bold text-xs block mb-1">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border rounded"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-xs block mb-1">
                    Son Başvuru
                  </label>
                  <input
                    type="date"
                    className="w-full p-2 border rounded"
                    value={appDeadline}
                    onChange={(e) => setAppDeadline(e.target.value)}
                  />
                </div>
                <div>
                  <label className="font-bold text-xs block mb-1 flex items-center gap-1">
                    {isPremium ? (
                      <Crown size={12} className="text-purple-600" />
                    ) : (
                      <Lock size={12} />
                    )}{' '}
                    Bildirim (Gün)
                  </label>
                  <input
                    type="number"
                    disabled={!isPremium}
                    className="w-full p-2 border rounded"
                    value={reminderDays}
                    onChange={(e) => setReminderDays(parseInt(e.target.value))}
                  />
                </div>
              </>
            )}
          </div>

          <div>
            <label className="font-bold block mb-1">Açıklama</label>
            <textarea
              className="w-full p-2 border rounded"
              rows={3}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
            ></textarea>
          </div>

          <button className="w-full bg-blue-600 text-white py-3 rounded font-bold flex justify-center items-center gap-2 hover:bg-blue-700">
            <Save size={18} /> Değişiklikleri Kaydet
          </button>
        </form>
      </div>

      {/* MODAL AYNI (Kod tekrarı olmaması için buraya sadece çağırma mantığını koydum, AddDocument ile aynı modal yapısını kullanabilirsin veya component yapabilirsin. Burada AddDocument'teki modalın aynısını kullan.) */}
      {manageModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 p-6 rounded-xl shadow-2xl w-96 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 border-b pb-2">
              <h3 className="font-bold text-lg">
                {manageCategory === 'doc_type'
                  ? 'Belge Türlerini Yönet'
                  : 'Lokasyonları Yönet'}
              </h3>
              <button onClick={() => setManageModalOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-4 max-h-60 pr-2">
              {(manageCategory === 'doc_type' ? typeOptions : locOptions).map(
                (item) => {
                  const isBusiness = manageCategory === 'location' && docScope === 'corporate' && corporateClients.some(
                    c => c?.name && item?.label && c.name.trim().toLowerCase() === item.label.trim().toLowerCase()
                  );
                  return (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-2 bg-gray-50 rounded border group hover:border-blue-200 transition text-gray-900"
                    >
                      {editingId === item.id ? (
                        <div className="flex gap-2 w-full">
                          <input
                            type="text"
                            className="flex-1 p-1 border rounded text-sm text-gray-900 bg-white"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            autoFocus
                          />
                          <button
                            onClick={() => saveEditing(item.id)}
                            className="text-green-600"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-red-500"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span className="text-sm font-medium text-gray-900">
                            {item.label}
                          </span>
                          {!isBusiness && (
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                              <button
                                onClick={() => startEditing(item.id, item.label)}
                                className="text-blue-500"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteDefinition(item.id)}
                                className="text-red-500"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  );
                }
              )}
            </div>
            <div className="flex gap-2 border-t pt-4">
              <input
                type="text"
                placeholder="Yeni ekle..."
                className="flex-1 p-2 border rounded text-sm text-gray-900 bg-white"
                value={newDefLabel}
                onChange={(e) => setNewDefLabel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddDefinition()}
              />
              <button
                onClick={handleAddDefinition}
                className="bg-blue-600 text-white p-2 rounded"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
