import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  ArrowLeft,
  Lock,
  Crown,
  Building,
  User,
  FileText,
  Plus,
  X,
  Edit2,
  Trash2,
  Save,
  BellRing,
  Loader,
} from 'lucide-react';

export default function AddDocument() {
  const navigate = useNavigate();

  // --- STATE'LER ---
  const [loadingPage, setLoadingPage] = useState(true); // Sayfa yükleniyor durumu
  const [uploading, setUploading] = useState(false);
  const [userRole, setUserRole] = useState('normal');
  const [myOrgId, setMyOrgId] = useState<string | null>(null);
  const [docScope, setDocScope] = useState<'personal' | 'corporate'>(
    'personal'
  );

  // Premium Kontrolü
  const [isPremium, setIsPremium] = useState(false);

  // Listeler
  const [typeOptions, setTypeOptions] = useState<any[]>([]);
  const [locOptions, setLocOptions] = useState<any[]>([]);
  const [selectedTypeId, setSelectedTypeId] = useState('');
  const [selectedLocId, setSelectedLocId] = useState('');

  // Form Verileri
  const [desc, setDesc] = useState('');
  const [file, setFile] = useState<File | null>(null);

  // Tarihler
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [appDeadline, setAppDeadline] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [reminderDays, setReminderDays] = useState<number>(5);
  const [reminderBase, setReminderBase] = useState<'expiry' | 'deadline'>(
    'expiry'
  );

  const [currentDocCount, setCurrentDocCount] = useState(0);

  // Modal Yönetimi
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageCategory, setManageCategory] = useState<'doc_type' | 'location'>(
    'doc_type'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newDefLabel, setNewDefLabel] = useState('');

  useEffect(() => {
    checkUserAndFetchDefs();
  }, []);

  const checkUserAndFetchDefs = async () => {
    setLoadingPage(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // 1. Profil ve Şirket Bilgilerini Çek
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            'role, organization_id, subscription_end_date, organization:organizations(subscription_end_date)'
          )
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        const role = profile?.role || 'normal';
        setUserRole(role);
        setMyOrgId(profile?.organization_id || null);

        // 2. PREMIUM KONTROLÜ (Güvenli Mantık)
        const now = new Date();
        let hasActivePremium = false;

        if (role === 'admin') {
          hasActivePremium = true;
        }
        // Kurumsal Roller: Şirket tarihine bakar
        else if (
          ['premium_corporate', 'corporate_chief', 'corporate_staff'].includes(
            role
          )
        ) {
          // 'organization' verisi bazen dizi bazen obje gelebilir, güvenli erişim:
          const orgData: any = profile.organization;
          if (orgData && orgData.subscription_end_date) {
            const endDate = new Date(orgData.subscription_end_date);
            if (endDate > now) hasActivePremium = true;
          }
        }
        // Bireysel: Kendi tarihine bakar
        else if (role === 'premium_individual') {
          if (profile.subscription_end_date) {
            const endDate = new Date(profile.subscription_end_date);
            if (endDate > now) hasActivePremium = true;
          }
        }

        setIsPremium(hasActivePremium);

        // 3. Varsayılan Kapsam (Scope)
        if (profile.organization_id) setDocScope('corporate');
        else setDocScope('personal');

        // 4. Tanımları ve Sayaçları Çek
        await fetchDefinitions(session.user.id);

        const { count } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .eq('uploader_id', session.user.id)
          .eq('is_archived', false);
        setCurrentDocCount(count || 0);
      }
    } catch (error: any) {
      console.error('Veri yükleme hatası:', error.message);
    } finally {
      setLoadingPage(false);
    }
  };

  const fetchDefinitions = async (userId: string) => {
    const { data: defs } = await supabase
      .from('user_definitions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (defs) {
      setTypeOptions(defs.filter((d) => d.category === 'doc_type'));
      setLocOptions(defs.filter((d) => d.category === 'location'));
    }
  };

  const canUploadCorporate = (isPremium || userRole === 'admin') && myOrgId;

  // --- YÖNETİM İŞLEMLERİ ---
  const handleAddDefinition = async () => {
    if (!newDefLabel.trim()) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;
    await supabase.from('user_definitions').insert([
      {
        user_id: session.user.id,
        category: manageCategory,
        label: newDefLabel.trim(),
      },
    ]);
    setNewDefLabel('');
    fetchDefinitions(session.user.id);
  };

  const handleDeleteDefinition = async (id: string) => {
    if (!window.confirm('Silmek istediğinize emin misiniz?')) return;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase.from('user_definitions').delete().eq('id', id);
    if (session) fetchDefinitions(session.user.id);
  };

  const saveEditing = async (id: string) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    await supabase
      .from('user_definitions')
      .update({ label: editValue })
      .eq('id', id);
    setEditingId(null);
    if (session) fetchDefinitions(session.user.id);
  };
  const openManageModal = (category: 'doc_type' | 'location') => {
    setManageCategory(category);
    setManageModalOpen(true);
  };

  // --- YÜKLEME İŞLEMİ ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acquisitionDate) return alert('Alınma Tarihi zorunludur.');
    if (!selectedTypeId) return alert('Belge türü seçilmelidir.');

    // Dosya Kontrolü
    if (file) {
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type))
        return alert('⛔ Geçersiz dosya formatı!');

      const fileSizeMB = file.size / (1024 * 1024);
      const maxMB = isPremium ? 50 : 1;
      if (fileSizeMB > maxMB)
        return alert(`⛔ Dosya boyutu çok büyük! Limitiniz: ${maxMB} MB`);
    }

    // Kota Kontrolü
    if (!isPremium && currentDocCount >= 5)
      return alert(`⛔ Belge Limitine Ulaştınız (5/5)!`);

    setUploading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const finalOrgId =
        canUploadCorporate && docScope === 'corporate' ? myOrgId : null;
      let publicUrl = null;
      let fileExt = null;
      let fileSize = 0; // Dosya boyutu (Byte)

      if (file) {
        fileSize = file.size; // Dosya boyutunu alıyoruz
        fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}.${fileExt}`;
        const folder = finalOrgId || session.user.id;
        const filePath = `${folder}/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        publicUrl = data.publicUrl;
      }

      const { error } = await supabase.from('documents').insert([
        {
          organization_id: finalOrgId,
          uploader_id: session.user.id,
          user_id: session.user.id, // Kullanıcı ID'si de eklenmeli
          title: file ? file.name : 'Dosyasız Kayıt',
          belge_adi: file ? file.name : 'Dosyasız Kayıt', // İsim eşitleme
          description: desc,
          type_def_id: selectedTypeId,
          location_def_id: selectedLocId || null,
          acquisition_date: acquisitionDate,
          expiry_date: isIndefinite ? null : expiryDate,
          son_tarih: isIndefinite ? null : expiryDate, // Dashboard için gerekli
          application_deadline: isIndefinite ? null : appDeadline || expiryDate,
          is_indefinite: isIndefinite,
          reminder_days: isPremium ? reminderDays : 0,
          reminder_based_on: reminderBase,
          is_archived: false,
          file_url: publicUrl,
          file_type: fileExt,
          file_size: fileSize, // <--- ÖNEMLİ: Dosya boyutu veritabanına yazılıyor
        },
      ]);

      if (error) throw error;
      alert('✅ Belge başarıyla kaydedildi!');
      navigate('/documents');
    } catch (error: any) {
      alert('Hata: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  if (loadingPage)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="animate-spin text-blue-600 mr-2" /> Yükleniyor...
      </div>
    );

  return (
    <div className="max-w-3xl mx-auto pb-10 relative">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-4 font-bold"
      >
        <ArrowLeft size={18} /> Geri Dön
      </button>

      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Upload className="text-blue-600" /> Yeni Belge Yükle
          </h2>
          {!isPremium && (
            <div className="text-xs bg-orange-50 text-orange-800 px-3 py-1 rounded-full border border-orange-200 font-bold">
              Kota: {currentDocCount}/5
            </div>
          )}
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          {/* KAPSAM SEÇİMİ */}
          {canUploadCorporate ? (
            <div className="bg-gray-50 p-4 rounded-xl border flex gap-4">
              <label
                className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                  docScope === 'corporate'
                    ? 'bg-blue-50 border-blue-400'
                    : 'bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  className="w-5 h-5 accent-blue-600"
                  checked={docScope === 'corporate'}
                  onChange={() => setDocScope('corporate')}
                />
                <div className="font-bold text-blue-800">
                  <Building size={20} className="inline mr-2" /> Kurumsal
                </div>
              </label>
              <label
                className={`flex-1 flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition ${
                  docScope === 'personal'
                    ? 'bg-purple-50 border-purple-400'
                    : 'bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="scope"
                  className="w-5 h-5 accent-purple-600"
                  checked={docScope === 'personal'}
                  onChange={() => setDocScope('personal')}
                />
                <div className="font-bold text-purple-800">
                  <User size={20} className="inline mr-2" /> Şahsi
                </div>
              </label>
            </div>
          ) : (
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-500">
              Bu belge <b>Şahsi</b> olarak yüklenecektir.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                <span>Belge Türü *</span>
                <button
                  type="button"
                  onClick={() => openManageModal('doc_type')}
                  className="text-xs text-blue-600 bg-blue-50 px-2 rounded"
                >
                  Yönet
                </button>
              </label>
              <select
                required
                className="w-full p-3 border rounded-lg bg-white"
                value={selectedTypeId}
                onChange={(e) => setSelectedTypeId(e.target.value)}
              >
                <option value="">Seçiniz...</option>
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1 flex justify-between">
                <span>Lokasyon</span>
                <button
                  type="button"
                  onClick={() => openManageModal('location')}
                  className="text-xs text-blue-600 bg-blue-50 px-2 rounded"
                >
                  Yönet
                </button>
              </label>
              <select
                className="w-full p-3 border rounded-lg bg-white"
                value={selectedLocId}
                onChange={(e) => setSelectedLocId(e.target.value)}
              >
                <option value="">(Belirtilmemiş)</option>
                {locOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1">
                Alınma Tarihi *
              </label>
              <input
                type="date"
                required
                className="w-full border p-2 rounded"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isIndefinite}
                onChange={(e) => setIsIndefinite(e.target.checked)}
              />
              <label>Bu belge süresizdir</label>
            </div>
            {!isIndefinite && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Bitiş Tarihi
                  </label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1">
                    Son Başvuru
                  </label>
                  <input
                    type="date"
                    className="w-full border p-2 rounded"
                    value={appDeadline}
                    onChange={(e) => setAppDeadline(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* HATIRLATMA ALANI */}
          <div
            className={`relative p-5 rounded-xl border transition-all overflow-hidden ${
              isPremium
                ? 'bg-purple-50 border-purple-200'
                : 'bg-gray-100 border-gray-300'
            }`}
          >
            {!isPremium && (
              <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center">
                <div className="bg-white p-3 rounded-full shadow-md mb-2">
                  <Lock className="text-gray-400" size={24} />
                </div>
                <div className="text-gray-800 font-bold text-sm">
                  Bu özellik sadece Premium üyeler içindir.
                </div>
                <Link
                  to="/pricing"
                  className="mt-2 text-xs bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-2 rounded-full font-bold shadow hover:scale-105 transition flex items-center gap-1"
                >
                  <Crown size={12} /> Premium'a Yükselt
                </Link>
              </div>
            )}

            <div className="flex justify-between items-center mb-3">
              <h3
                className={`font-bold flex items-center gap-2 ${
                  isPremium ? 'text-purple-800' : 'text-gray-500'
                }`}
              >
                {isPremium ? <BellRing size={18} /> : <Lock size={18} />}{' '}
                Otomatik Hatırlatma
              </h3>
              {isPremium && (
                <span className="text-[10px] bg-purple-200 text-purple-800 px-2 py-0.5 rounded font-bold">
                  PREMIUM
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                disabled={!isPremium || isIndefinite}
                min="1"
                max="90"
                className="w-20 p-2 border rounded text-center font-bold outline-none disabled:bg-gray-200"
                value={reminderDays}
                onChange={(e) => setReminderDays(parseInt(e.target.value))}
              />
              <span className="text-sm text-gray-700 font-medium">
                gün kala e-posta gönder.
              </span>
            </div>
          </div>

          {/* DOSYA YÜKLEME */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition relative">
            <input
              type="file"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) =>
                setFile(e.target.files ? e.target.files[0] : null)
              }
            />
            <div className="flex flex-col items-center gap-2">
              <FileText size={32} className="text-gray-400" />
              <p className="text-sm font-bold text-gray-700">
                {file ? file.name : 'Dosya Seçin (Opsiyonel)'}
              </p>
              <p className="text-xs text-gray-400">
                PDF, Word, Resim (Max {isPremium ? '50' : '1'} MB)
              </p>
            </div>
          </div>

          <button
            disabled={uploading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg"
          >
            {uploading ? 'Kaydediliyor...' : 'Belgeyi Kaydet'}
          </button>
        </form>
      </div>

      {manageModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-80">
            <div className="flex justify-between mb-4">
              <h3 className="font-bold">Yönet</h3>
              <button onClick={() => setManageModalOpen(false)}>
                <X />
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                className="border p-2 w-full rounded"
                value={newDefLabel}
                onChange={(e) => setNewDefLabel(e.target.value)}
                placeholder="Yeni ekle..."
              />
              <button onClick={handleAddDefinition}>
                <Plus />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {(manageCategory === 'doc_type' ? typeOptions : locOptions).map(
                (i) => (
                  <div
                    key={i.id}
                    className="flex justify-between p-2 bg-gray-50 rounded group"
                  >
                    {editingId === i.id ? (
                      <>
                        <input
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="w-20"
                        />
                        <button onClick={() => saveEditing(i.id)}>
                          <Save size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">{i.label}</span>
                        <div className="hidden group-hover:flex gap-1">
                          <button
                            onClick={() => {
                              setEditingId(i.id);
                              setEditValue(i.label);
                            }}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteDefinition(i.id)}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
