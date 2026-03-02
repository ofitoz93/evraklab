import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { useNavigate, Link } from 'react-router-dom';
import {
  Upload,
  ArrowLeft,
  Building,
  User,
  FileText,
  Plus,
  X,
  Edit2,
  Trash2,
  Save,
  Loader,
  Brain,
  Sparkles,
  Globe,
  Info,
  XCircle,
} from 'lucide-react';
import { analyzeDocumentWithAI } from './aiService';

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
  const [file, setFile] = useState<File | null>(null); // Tekli dosya (Manuel Mod)
  const [files, setFiles] = useState<File[]>([]); // Çoklu dosyalar (AI Modu)
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [acquisitionDate, setAcquisitionDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [appDeadline, setAppDeadline] = useState('');
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [reminderDays] = useState(30);
  const reminderBase = 'expiry';

  // Toplu Analiz Sonuçları
  const [bulkAnalysisResults, setBulkAnalysisResults] = useState<any[]>([]);
  const [analyzingIndexes, setAnalyzingIndexes] = useState<number[]>([]);

  const [currentDocCount, setCurrentDocCount] = useState(0);

  // Modal Yönetimi
  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [manageCategory, setManageCategory] = useState<'doc_type' | 'location'>(
    'doc_type'
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [newDefLabel, setNewDefLabel] = useState('');

  // AI Analiz State'leri
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [uploadMode, setUploadMode] = useState<'ai' | 'manual'>('ai');

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
        if ((role === 'admin' || role === 'premium_corporate' || profile?.organization_id)) {
          setDocScope('corporate');
        }

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

  const handleAIAnalysis = async () => {
    const filesToAnalyze = uploadMode === 'ai' ? files : (file ? [file] : []);
    if (filesToAnalyze.length === 0) return alert('Lütfen önce bir dosya seçin.');

    setIsAnalyzing(true);

    for (let i = 0; i < filesToAnalyze.length; i++) {
      const currentFile = filesToAnalyze[i];

      // Eğer zaten analiz edildiyse ve hatasızsa atla
      const existing = bulkAnalysisResults.find(r => r.fileName === currentFile.name);
      if (existing && !existing.error) continue;

      // İstekler arası bekleme (Kota koruması)
      if (i > 0) await new Promise(r => setTimeout(r, 1000));

      setAnalyzingIndexes(prev => [...prev, i]);
      try {
        const result = await analyzeDocumentWithAI(currentFile);
        const analysisData = {
          fileName: currentFile.name,
          ...result,
          selectedTypeId: '',
          selectedLocId: selectedLocId,
          error: null
        };

        // Belge türünü eşleştir
        const matchedType = typeOptions.find(t =>
          t.label.toLowerCase() === result.docType.toLowerCase() ||
          t.label.toLowerCase().includes(result.docType.toLowerCase()) ||
          result.docType.toLowerCase().includes(t.label.toLowerCase())
        );

        if (matchedType) {
          analysisData.selectedTypeId = matchedType.id;
        } else if (result.docType) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const { data: newType } = await supabase
              .from('user_definitions')
              .insert([{
                user_id: session.user.id,
                category: 'doc_type',
                label: result.docType
              }])
              .select()
              .single();
            if (newType) {
              analysisData.selectedTypeId = newType.id;
              await fetchDefinitions(session.user.id);
            }
          }
        }

        // Sonuçları güncelle (Eski hatayı temizle)
        setBulkAnalysisResults(prev => {
          const filtered = prev.filter(r => r.fileName !== currentFile.name);
          return [...filtered, analysisData];
        });

        // Eğer Manuel moddaysa form alanlarını da doldur (Legacy destek)
        if (uploadMode === 'manual') {
          setTitle(currentFile.name);
          if (result.acquisitionDate) setAcquisitionDate(result.acquisitionDate);
          if (result.expiryDate) setExpiryDate(result.expiryDate);
          if (result.applicationDeadline) setAppDeadline(result.applicationDeadline);
          if (matchedType) setSelectedTypeId(matchedType.id);
          if (result.isIndefinite) setIsIndefinite(true);
        }

      } catch (error: any) {
        console.error(`${currentFile.name} analiz hatası:`, error.message);
        const isQuota = error.message?.includes('429') || error.message?.includes('quota');
        const errorMsg = isQuota ? "Günlük limit doldu, lütfen biraz bekleyip tekrar deneyin." : (error.message || 'Analiz başarısız.');

        const errData = {
          fileName: currentFile.name,
          error: errorMsg,
          acquisitionDate: '',
          docType: 'Bilinmiyor',
          selectedTypeId: '',
          selectedLocId: selectedLocId
        };
        setBulkAnalysisResults(prev => {
          const filtered = prev.filter(r => r.fileName !== currentFile.name);
          return [...filtered, errData];
        });
      } finally {
        setAnalyzingIndexes(prev => prev.filter(idx => idx !== i));
      }
    }
    setIsAnalyzing(false);
  };

  const retryAnalysis = async (fileName: string) => {
    const fileToAnalyze = files.find(f => f.name === fileName);
    if (!fileToAnalyze) return;

    // Geçici olarak analyzing indexes'e ekle
    const idx = files.findIndex(f => f.name === fileName);
    setAnalyzingIndexes(prev => [...prev, idx]);

    try {
      const result = await analyzeDocumentWithAI(fileToAnalyze);
      const analysisData = {
        fileName: fileToAnalyze.name,
        ...result,
        selectedTypeId: '',
        selectedLocId: selectedLocId,
        error: null
      };

      const matchedType = typeOptions.find(t =>
        t.label.toLowerCase() === result.docType.toLowerCase() ||
        t.label.toLowerCase().includes(result.docType.toLowerCase()) ||
        result.docType.toLowerCase().includes(t.label.toLowerCase())
      );
      if (matchedType) analysisData.selectedTypeId = matchedType.id;

      setBulkAnalysisResults(prevResults => {
        const updatedResults = prevResults.filter(r => r.fileName !== fileName);
        return [...updatedResults, analysisData];
      });
    } catch (error: any) {
      alert("Tekrar deneme başarısız: " + error.message);
    } finally {
      setAnalyzingIndexes(prev => prev.filter(i => i !== idx));
    }
  };

  // --- YÜKLEME İŞLEMİ ---
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();

    const docsToUpload = uploadMode === 'ai'
      ? bulkAnalysisResults
      : [{
        acquisitionDate,
        expiryDate,
        appDeadline,
        isIndefinite,
        selectedTypeId,
        selectedLocId,
        title,
        description: desc,
        file: file
      }];

    if (docsToUpload.length === 0) return alert('Yüklenecek belge bulunamadı.');

    // Zorunlu Alan Kontrolü (Toplu Yükleme için)
    for (const doc of docsToUpload) {
      const typeId = doc.selectedTypeId || selectedTypeId;
      const acqDate = doc.acquisitionDate || acquisitionDate;

      if (!typeId || typeId === '') {
        return alert(`⛔ "${doc.fileName || 'Belge'}" için Belge Türü seçilmelidir.`);
      }
      if (!acqDate || acqDate === '') {
        return alert(`⛔ "${doc.fileName || 'Belge'}" için Alınma Tarihi zorunludur.`);
      }
    }

    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const finalOrgId = canUploadCorporate && docScope === 'corporate' ? myOrgId : null;

      for (const doc of docsToUpload) {
        let publicUrl = null;
        let fileExt = null;
        let fileSize = 0;

        const currentFile = uploadMode === 'ai'
          ? files.find(f => f.name === doc.fileName)
          : file;

        if (currentFile) {
          fileSize = currentFile.size;
          fileExt = currentFile.name.split('.').pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const folder = finalOrgId || session.user.id;
          const filePath = `${folder}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('documents')
            .upload(filePath, currentFile);
          if (uploadError) throw uploadError;

          const { data } = supabase.storage.from('documents').getPublicUrl(filePath);
          publicUrl = data.publicUrl;
        }

        const { error } = await supabase.from('documents').insert([
          {
            organization_id: finalOrgId,
            uploader_id: session.user.id,
            title: doc.title || doc.fileName || (file ? file.name : 'Dosyasız Kayıt'),
            description: doc.description || desc || null,
            type_def_id: (doc.selectedTypeId && doc.selectedTypeId !== '') ? doc.selectedTypeId : (selectedTypeId !== '' ? selectedTypeId : null),
            location_def_id: (doc.selectedLocId && doc.selectedLocId !== '') ? doc.selectedLocId : (selectedLocId !== '' ? selectedLocId : null),
            acquisition_date: doc.acquisitionDate || acquisitionDate,
            expiry_date: (doc.isIndefinite || isIndefinite) ? null : (doc.expiryDate || expiryDate || null),
            application_deadline: (doc.isIndefinite || isIndefinite) ? null : (doc.appDeadline || appDeadline || doc.expiryDate || expiryDate || null),
            is_indefinite: doc.isIndefinite || isIndefinite || false,
            reminder_days: isPremium ? reminderDays : 0,
            reminder_based_on: reminderBase,
            is_archived: false,
            file_url: publicUrl,
            file_type: fileExt,
            file_size: fileSize,
          },
        ]);

        if (error) throw error;
      }

      alert('✅ Tüm belgeler başarıyla kaydedildi!');
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

        {/* MOD SEÇİMİ */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button
            type="button"
            onClick={() => setUploadMode('ai')}
            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${uploadMode === 'ai'
              ? 'border-purple-500 bg-purple-50 shadow-md'
              : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
          >
            <div className={`p-2 rounded-lg ${uploadMode === 'ai' ? 'bg-purple-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Brain size={24} />
            </div>
            <div className="text-center">
              <div className={`font-bold text-sm ${uploadMode === 'ai' ? 'text-purple-800' : 'text-gray-600'}`}>Yapay Zeka Modu</div>
              <div className="text-[10px] text-gray-400">Hızlı & Otomatik (Önerilen)</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setUploadMode('manual')}
            className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${uploadMode === 'manual'
              ? 'border-blue-500 bg-blue-50 shadow-md'
              : 'border-gray-100 bg-white hover:border-gray-300'
              }`}
          >
            <div className={`p-2 rounded-lg ${uploadMode === 'manual' ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
              <Edit2 size={24} />
            </div>
            <div className="text-center">
              <div className={`font-bold text-sm ${uploadMode === 'manual' ? 'text-blue-800' : 'text-gray-600'}`}>Manuel Mod</div>
              <div className="text-[10px] text-gray-400">Klasik & Detaylı Kontrol</div>
            </div>
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-6">
          {/* KAPSAM SEÇİMİ - HER İKİ MODDA DA GÖRÜNSÜN */}
          {canUploadCorporate && (
            <div className="bg-purple-50/50 p-4 rounded-2xl border-2 border-dashed border-purple-200 flex flex-col gap-3">
              <div className="text-xs font-bold text-purple-700 uppercase flex items-center gap-2">
                <Globe size={14} /> Belge Kapsamı (Nereye Kaydedilecek?)
              </div>
              <div className="flex gap-4">
                <label
                  className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${docScope === 'corporate'
                    ? 'bg-white border-blue-500 shadow-md scale-[1.02]'
                    : 'bg-white/50 border-transparent hover:border-gray-200'
                    }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="w-5 h-5 accent-blue-600"
                    checked={docScope === 'corporate'}
                    onChange={() => setDocScope('corporate')}
                  />
                  <div className="flex flex-col items-center">
                    <div className={`font-bold text-sm ${docScope === 'corporate' ? 'text-blue-700' : 'text-gray-500'}`}>
                      <Building size={18} className="inline mr-2" /> KURUMSAL
                    </div>
                    <span className="text-[10px] text-gray-400">Şirket dökümanlarına ekle</span>
                  </div>
                </label>
                <label
                  className={`flex-1 flex items-center justify-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${docScope === 'personal'
                    ? 'bg-white border-purple-500 shadow-md scale-[1.02]'
                    : 'bg-white/50 border-transparent hover:border-gray-200'
                    }`}
                >
                  <input
                    type="radio"
                    name="scope"
                    className="w-5 h-5 accent-purple-600"
                    checked={docScope === 'personal'}
                    onChange={() => setDocScope('personal')}
                  />
                  <div className="flex flex-col items-center">
                    <div className={`font-bold text-sm ${docScope === 'personal' ? 'text-purple-700' : 'text-gray-500'}`}>
                      <User size={18} className="inline mr-2" /> ŞAHSİ
                    </div>
                    <span className="text-[10px] text-gray-400">Sadece sana özel kalsın</span>
                  </div>
                </label>
              </div>
            </div>
          )}
          {!canUploadCorporate && (
            <div className="bg-gray-50 p-3 rounded text-sm text-gray-500 flex items-center gap-2">
              <Info size={16} /> Bu belge <b>Şahsi</b> olarak yüklenecektir.
            </div>
          )}

          {uploadMode === 'manual' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Belge Başlığı
                  </label>
                  <input
                    type="text"
                    className="w-full p-3 border rounded-lg bg-white"
                    placeholder="Örn: 2026 Çevre İzni Belgesi"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
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
                    required={uploadMode === 'manual'}
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
                    required={uploadMode === 'manual'}
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

              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Açıklama / Notlar
                </label>
                <textarea
                  className="w-full p-3 border rounded-lg bg-white resize-none"
                  rows={2}
                  placeholder="Eklemek istediğiniz notlar..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                ></textarea>
              </div>
            </>
          )}


          {/* DOSYA YÜKLEME ALANI */}
          <div className="border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center hover:bg-gray-50 transition relative group">
            <input
              type="file"
              multiple={uploadMode === 'ai'}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              onChange={(e) => {
                const selected = e.target.files ? Array.from(e.target.files) : [];
                if (uploadMode === 'ai') {
                  setFiles(prev => [...prev, ...selected]);
                } else {
                  setFile(selected[0] || null);
                }
              }}
            />
            <div className="flex flex-col items-center gap-3">
              <div className="bg-gray-100 p-4 rounded-full group-hover:scale-110 transition">
                <FileText size={40} className="text-gray-400" />
              </div>
              <p className="text-base font-bold text-gray-700">
                {uploadMode === 'ai'
                  ? (files.length > 0 ? `${files.length} Dosya Seçildi` : 'Belgeleri Buraya Sürükleyin veya Tıklayın')
                  : (file ? file.name : 'Belgeyi Buraya Sürükleyin veya Tıklayın')}
              </p>
              <p className="text-xs text-gray-400">
                PDF, Word, Resim (Max {isPremium ? '50' : '1'} MB)
              </p>
            </div>
          </div>

          {/* AI MODU - ANALİZ LİSTESİ */}
          {uploadMode === 'ai' && files.length > 0 && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-purple-100/50 p-4 rounded-xl border border-purple-200">
                <div className="flex items-center gap-3">
                  <Brain className="text-purple-600" size={24} />
                  <div>
                    <h3 className="font-bold text-purple-900 text-sm">Yapay Zeka Toplu Analiz</h3>
                    <p className="text-[10px] text-purple-600 uppercase tracking-wider">
                      {files.length} dosya analiz edilmeye hazır
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleAIAnalysis}
                  disabled={isAnalyzing}
                  className="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold shadow-lg hover:bg-purple-700 transition flex items-center gap-2"
                >
                  {isAnalyzing ? <Loader size={16} className="animate-spin" /> : <Sparkles size={16} />}
                  {isAnalyzing ? 'Analiz Ediliyor...' : 'Tümünü Analiz Et'}
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {files.map((f, idx) => {
                  const result = bulkAnalysisResults.find(r => r.fileName === f.name);
                  const isCurrentAnalyzing = analyzingIndexes.includes(idx);

                  return (
                    <div key={idx} className={`p-4 rounded-xl border transition-all ${result ? (result.error ? 'bg-red-50 border-red-200' : 'bg-white border-green-200') : 'bg-white border-gray-100 shadow-sm'}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3 overflow-hidden">
                          {result ? (result.error ? <XCircle className="text-red-500 shrink-0" size={18} /> : <Sparkles className="text-green-500 shrink-0" size={18} />) : (isCurrentAnalyzing ? <Loader className="text-purple-500 animate-spin shrink-0" size={18} /> : <FileText className="text-gray-400 shrink-0" size={18} />)}
                          <span className="font-bold text-gray-800 text-sm truncate">{f.name}</span>
                        </div>
                        <button
                          onClick={() => {
                            setFiles(files.filter((_, i) => i !== idx));
                            setBulkAnalysisResults(bulkAnalysisResults.filter(r => r.fileName !== f.name));
                          }}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      {result ? (
                        result.error ? (
                          <div className="mt-2 space-y-2">
                            <div className="p-2 bg-red-50 border border-red-100 rounded text-[10px] text-red-600">
                              <b>Analiz Durduruldu:</b> {result.error}
                            </div>
                            <button
                              type="button"
                              onClick={() => retryAnalysis(f.name)}
                              className="w-full py-1 text-[10px] bg-red-100 text-red-700 rounded hover:bg-red-200 transition font-bold"
                            >
                              Tekrar Analiz Etmeyi Dene
                            </button>
                            <div className="text-[9px] text-gray-400 italic text-center">
                              Veya belgeyi Manuel Düzenle modundan yükleyebilirsiniz.
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-[10px]">
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-400 block">Tür:</span>
                                <span className="font-bold text-gray-700 uppercase line-clamp-1">
                                  {typeOptions.find(t => t.id === result.selectedTypeId)?.label || result.docType}
                                </span>
                              </div>
                              <div className="bg-gray-50 p-2 rounded">
                                <span className="text-gray-400 block">Bitiş:</span>
                                <span className="font-bold text-red-600">{result.expiryDate || (result.isIndefinite ? 'SÜRESİZ' : '-')}</span>
                              </div>
                            </div>

                            <div className="bg-purple-50 p-2 rounded border border-purple-100">
                              <label className="block text-[10px] font-bold text-purple-700 mb-1">📍 Lokasyon Seçin</label>
                              <select
                                className="w-full text-xs bg-transparent border-none outline-none font-medium"
                                value={result.selectedLocId}
                                onChange={(e) => {
                                  const newResults = bulkAnalysisResults.map(r =>
                                    r.fileName === f.name ? { ...r, selectedLocId: e.target.value } : r
                                  );
                                  setBulkAnalysisResults(newResults);
                                }}
                              >
                                <option value="">Lokasyon Seçilmedi</option>
                                {locOptions.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                              </select>
                            </div>
                          </div>
                        )
                      ) : (
                        <div className="text-[10px] text-gray-400 italic py-2">
                          {isCurrentAnalyzing ? 'AI tarafından analiz ediliyor...' : 'Analiz edilmeyi bekliyor.'}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            disabled={uploading || (uploadMode === 'ai' && bulkAnalysisResults.length === 0)}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg disabled:bg-gray-300 flex items-center justify-center gap-2"
          >
            {uploading ? <Loader size={20} className="animate-spin" /> : <Save size={20} />}
            {uploading ? 'Belgeler Kaydediliyor...' : (uploadMode === 'ai' ? 'Tüm Belgeleri Sisteme Kaydet' : 'Belgeyi Kaydet')}
          </button>
        </form >
      </div >

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
    </div >
  );
}
