import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import {
  ArrowLeft,
  Upload,
  FlaskConical,
  Loader,
  CheckCircle,
  AlertTriangle,
  Trash2,
  FileText,
  Info,
} from 'lucide-react';
import { extractTextFromPdf } from './localScanner';
import {
  parseMsdsText,
  computeExpiryDate,
  computeMsdsStatus,
  computeDaysRemaining,
  tierLabel,
  MSDS_STATUS_LABELS_TR as STATUS_LABELS,
  MSDS_STATUS_BADGE_CLASSES as STATUS_BADGE_CLASSES,
  type MsdsParseResult,
  type MsdsStatus,
  type DateCandidate,
} from './msdsParser';

interface MsdsRow {
  id: string;
  file: File;
  status: 'pending' | 'parsing' | 'parsed' | 'error';
  parseResult: MsdsParseResult | null;
  productName: string;
  productNameManualOverride: boolean;
  primaryDateIso: string;
  primaryDateManualOverride: boolean;
  otherDates: DateCandidate[];
  validityYears: number;
  warningThresholdDays: number;
  error: string | null;
}

function rowExpiry(row: MsdsRow): string | null {
  return row.primaryDateIso ? computeExpiryDate(row.primaryDateIso, row.validityYears) : null;
}

function rowStatus(row: MsdsRow): MsdsStatus {
  return computeMsdsStatus(rowExpiry(row), row.warningThresholdDays);
}

function rowNeedsManualDate(row: MsdsRow): boolean {
  if (row.status === 'error') return true;
  if (row.status !== 'parsed') return false;
  return !row.parseResult?.hasExtractedText || !row.primaryDateIso;
}

export default function AddMsdsDocuments() {
  const navigate = useNavigate();

  const [loadingPage, setLoadingPage] = useState(true);
  const [orgId, setOrgId] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const [selectedClientId, setSelectedClientId] = useState('');
  const [batchValidityYears, setBatchValidityYears] = useState(5);
  const [batchWarningDays, setBatchWarningDays] = useState(30);

  const [rows, setRows] = useState<MsdsRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState<{ done: number; total: number } | null>(null);

  const getAssignmentUserIds = async (roleParam: string, uIdParam: string): Promise<string[]> => {
    if (roleParam !== 'corporate_chief') return [uIdParam];
    const { data: subs } = await supabase.from('profiles').select('id').eq('manager_id', uIdParam);
    return [uIdParam, ...(subs?.map((s: any) => s.id) || [])];
  };

  const loadInitialData = async () => {
    setLoadingPage(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, organization_id, extra_permissions')
        .eq('id', session.user.id)
        .single();

      const role = profile?.role || '';
      const oId = profile?.organization_id || '';
      setOrgId(oId);

      if (!oId) {
        setClients([]);
        setLoadingPage(false);
        return;
      }

      let query = supabase.from('consultant_clients').select('id, name');
      const isRestrictedRole = role === 'corporate_staff' || role === 'corporate_chief';
      const canViewAll =
        role === 'premium_corporate' ||
        role === 'admin' ||
        role === 'system_admin' ||
        !!profile?.extra_permissions?.can_view_all_clients;

      if (isRestrictedRole && !canViewAll) {
        const assignmentUserIds = await getAssignmentUserIds(role, session.user.id);
        const { data: assignments } = await supabase
          .from('consultant_assignments')
          .select('client_id')
          .in('user_id', assignmentUserIds);
        const cIds = assignments?.map((a: any) => a.client_id) || [];
        query = cIds.length > 0 ? query.in('id', cIds) : query.eq('id', '00000000-0000-0000-0000-000000000000');
      } else {
        query = query.eq('consultant_company_id', oId);
      }

      const { data } = await query.order('name', { ascending: true });
      setClients(data || []);
    } catch (err: any) {
      console.error('MSDS sayfası yüklenirken hata:', err.message);
    } finally {
      setLoadingPage(false);
    }
  };

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const parseRow = async (rowId: string, file: File) => {
    setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, status: 'parsing' } : r)));
    try {
      const text = await extractTextFromPdf(file);
      const parsed = parseMsdsText(text);
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId
            ? {
                ...r,
                status: 'parsed',
                parseResult: parsed,
                productName: parsed.productName.productName || '',
                primaryDateIso: parsed.dates.primaryDate?.date || '',
                otherDates: parsed.dates.otherDates,
              }
            : r
        )
      );
    } catch (err: any) {
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, status: 'error', error: err.message || 'Ayrıştırma hatası' } : r))
      );
    }
  };

  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const pdfFiles = Array.from(fileList).filter((f) => f.name.toLowerCase().endsWith('.pdf'));
    const rejected = fileList.length - pdfFiles.length;
    if (rejected > 0) {
      alert(`${rejected} dosya PDF olmadığı için atlandı. Sadece .pdf dosyaları desteklenir.`);
    }

    const newRows: MsdsRow[] = pdfFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}`,
      file,
      status: 'pending',
      parseResult: null,
      productName: '',
      productNameManualOverride: false,
      primaryDateIso: '',
      primaryDateManualOverride: false,
      otherDates: [],
      validityYears: batchValidityYears,
      warningThresholdDays: batchWarningDays,
      error: null,
    }));

    setRows((prev) => [...prev, ...newRows]);

    for (const row of newRows) {
      await parseRow(row.id, row.file);
    }
  };

  const updateRow = (id: string, patch: Partial<MsdsRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const handleRemoveRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const findOrCreateDefinition = async (
    category: 'doc_type' | 'location',
    label: string,
    session: any
  ): Promise<string> => {
    const { data: existing } = await supabase
      .from('user_definitions')
      .select('id')
      .eq('category', category)
      .eq('organization_id', orgId)
      .ilike('label', label.trim())
      .limit(1);
    if (existing && existing.length > 0) return existing[0].id;

    const { data: created, error } = await supabase
      .from('user_definitions')
      .insert([{ user_id: session.user.id, category, label: label.trim(), organization_id: orgId }])
      .select()
      .single();
    if (error) throw error;
    return created.id;
  };

  const isRowValid = (row: MsdsRow) =>
    row.status === 'parsed' || row.status === 'error'
      ? row.productName.trim() !== '' && row.primaryDateIso !== ''
      : false;

  const canSave =
    !saving &&
    !!selectedClientId &&
    rows.length > 0 &&
    rows.every((r) => r.status !== 'parsing') &&
    rows.every(isRowValid);

  const handleSaveAll = async () => {
    if (!selectedClientId) return alert('Lütfen işletme seçin.');
    if (rows.length === 0) return alert('Yüklenecek MSDS bulunamadı.');
    const invalidRows = rows.filter((r) => !isRowValid(r));
    if (invalidRows.length > 0) {
      return alert(
        `Şu dosyalarda ürün adı ve/veya tarih eksik, önce doldurun:\n${invalidRows
          .map((r) => r.file.name)
          .join('\n')}`
      );
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setSaving(true);
    setSaveProgress({ done: 0, total: rows.length });
    const failures: string[] = [];

    try {
      const client = clients.find((c) => c.id === selectedClientId);
      const typeDefId = await findOrCreateDefinition('doc_type', 'MSDS / Güvenlik Bilgi Formu', session);
      const locationDefId = client ? await findOrCreateDefinition('location', client.name, session) : null;

      let done = 0;
      for (const row of rows) {
        try {
          const fileExt = row.file.name.split('.').pop() || 'pdf';
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
          const filePath = `${orgId}/${fileName}`;

          const { error: uploadError } = await supabase.storage.from('documents').upload(filePath, row.file);
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('documents').getPublicUrl(filePath);
          const publicUrl = urlData.publicUrl;

          const expiry = rowExpiry(row);
          const primaryDateCandidate = row.parseResult?.dates.primaryDate || null;

          const { data: newDoc, error: docError } = await supabase
            .from('documents')
            .insert([
              {
                organization_id: orgId,
                uploader_id: session.user.id,
                title: row.productName.trim(),
                description: null,
                type_def_id: typeDefId,
                location_def_id: locationDefId,
                acquisition_date: row.primaryDateIso,
                expiry_date: expiry,
                application_deadline: expiry,
                is_indefinite: false,
                reminder_days: row.warningThresholdDays,
                reminder_based_on: 'expiry',
                is_archived: false,
                file_url: publicUrl,
                file_type: fileExt,
                file_size: row.file.size,
              },
            ])
            .select()
            .single();
          if (docError) throw docError;

          const isManual = row.primaryDateManualOverride || row.productNameManualOverride;
          const { error: msdsError } = await supabase.from('msds_documents').insert([
            {
              client_id: selectedClientId,
              consultant_company_id: orgId,
              document_id: newDoc.id,
              uploaded_by: session.user.id,
              product_name: row.productName.trim(),
              product_name_source: row.parseResult?.productName.source || null,
              product_name_manual_override: row.productNameManualOverride,
              primary_date: row.primaryDateIso,
              primary_date_source_label: row.primaryDateManualOverride ? null : primaryDateCandidate?.label || null,
              primary_date_tier: row.primaryDateManualOverride ? null : primaryDateCandidate?.tier || null,
              primary_date_day_defaulted: row.primaryDateManualOverride
                ? false
                : !!primaryDateCandidate?.dayDefaulted,
              primary_date_manual_override: row.primaryDateManualOverride,
              other_dates: row.otherDates,
              validity_years: row.validityYears,
              warning_threshold_days: row.warningThresholdDays,
              expiry_date: expiry,
              extraction_status: isManual ? 'manual' : 'auto',
              extracted_char_count: row.parseResult?.extractedCharCount || 0,
              original_file_name: row.file.name,
              file_url: publicUrl,
              file_type: fileExt,
              file_size: row.file.size,
              is_archived: false,
            },
          ]);
          if (msdsError) throw msdsError;
        } catch (err: any) {
          failures.push(`${row.file.name}: ${err.message}`);
        } finally {
          done++;
          setSaveProgress({ done, total: rows.length });
        }
      }

      if (failures.length > 0) {
        alert(
          `${rows.length - failures.length} / ${rows.length} MSDS başarıyla kaydedildi.\n\nBaşarısız olanlar:\n${failures.join('\n')}`
        );
      } else {
        alert('Tüm MSDS belgeleri başarıyla kaydedildi.');
        navigate('/consultant');
      }
    } catch (err: any) {
      alert('Kaydetme sırasında beklenmeyen bir hata oluştu: ' + err.message);
    } finally {
      setSaving(false);
      setSaveProgress(null);
    }
  };

  if (loadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <Loader className="animate-spin text-blue-600 mr-2" /> Yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-16 relative">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white mb-4 font-bold"
      >
        <ArrowLeft size={18} /> Geri Dön
      </button>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm mb-6">
        <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2 mb-1">
          <FlaskConical className="text-teal-600" size={22} /> Toplu MSDS/SDS Yükleme
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 font-medium">
          PDF'lerden ürün adı ve belge tarihi otomatik tespit edilir; geçerlilik tarihi buna göre hesaplanır.
          Kaydetmeden önce her satırı kontrol edip gerekirse düzeltebilirsiniz.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
              İşletme *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="">-- İşletme Seçin --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
              Geçerlilik Süresi (Yıl)
            </label>
            <input
              type="number"
              min={1}
              step={0.5}
              value={batchValidityYears}
              onChange={(e) => setBatchValidityYears(parseFloat(e.target.value) || 5)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 uppercase">
              Uyarı Eşiği (Gün)
            </label>
            <input
              type="number"
              min={1}
              value={batchWarningDays}
              onChange={(e) => setBatchWarningDays(parseInt(e.target.value, 10) || 30)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>
        </div>
        <p className="text-[11px] text-gray-400 mt-1.5">
          Bu değerler yüklenecek yeni dosyalara varsayılan olarak uygulanır; her dosya için ayrı ayrı da değiştirilebilir.
        </p>

        <label className="mt-4 flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-xl p-8 cursor-pointer hover:border-teal-400 hover:bg-teal-50/30 dark:hover:bg-teal-950/10 transition">
          <Upload className="text-teal-600" size={28} />
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">PDF dosyalarını seçin veya sürükleyin</span>
          <span className="text-[11px] text-gray-400">Birden fazla dosya seçebilirsiniz</span>
          <input type="file" multiple accept=".pdf" className="hidden" onChange={(e) => handleFilesSelected(e.target.files)} />
        </label>
      </div>

      {rows.length > 0 && (
        <div className="space-y-4">
          {rows.map((row) => {
            const status = rowStatus(row);
            const expiry = rowExpiry(row);
            const daysRemaining = computeDaysRemaining(expiry);
            const needsManual = rowNeedsManualDate(row);

            return (
              <div
                key={row.id}
                className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm p-5"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {row.status === 'parsing' && <Loader className="animate-spin text-blue-500 shrink-0" size={18} />}
                    {row.status === 'parsed' && !needsManual && (
                      <CheckCircle className="text-emerald-500 shrink-0" size={18} />
                    )}
                    {(row.status === 'error' || needsManual) && (
                      <AlertTriangle className="text-amber-500 shrink-0" size={18} />
                    )}
                    {row.status === 'pending' && <FileText className="text-gray-400 shrink-0" size={18} />}
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-300 truncate" title={row.file.name}>
                      {row.file.name}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveRow(row.id)}
                    className="text-gray-400 hover:text-red-600 shrink-0"
                    title="Listeden çıkar"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {row.status === 'error' && (
                  <div className="text-xs text-red-600 mb-3">PDF okunamadı: {row.error}</div>
                )}

                {needsManual && (
                  <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-[11px] font-bold px-3 py-2 rounded-lg mb-3">
                    <Info size={14} className="shrink-0" />
                    Metin okunamadı veya tarih bulunamadı — devam etmeden önce tarihi elle girin.
                  </div>
                )}

                {(row.status === 'parsed' || row.status === 'error') && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ürün Adı</label>
                      <input
                        type="text"
                        value={row.productName}
                        onChange={(e) =>
                          updateRow(row.id, { productName: e.target.value, productNameManualOverride: true })
                        }
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                        placeholder="Ürün adı girin"
                      />
                      {row.parseResult?.productName.source === 'heuristic_top_lines' && !row.productNameManualOverride && (
                        <span className="text-[10px] text-gray-400">Otomatik (belge başlığından tahmin)</span>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Ana Tarih</label>
                      <input
                        type="date"
                        value={row.primaryDateIso}
                        onChange={(e) =>
                          updateRow(row.id, { primaryDateIso: e.target.value, primaryDateManualOverride: true })
                        }
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                      />
                      {row.parseResult?.dates.primaryDate && !row.primaryDateManualOverride && (
                        <span className="text-[10px] text-gray-400">
                          Kaynak: {row.parseResult.dates.primaryDate.label} ({tierLabel(row.parseResult.dates.primaryDate.tier)})
                          {row.parseResult.dates.primaryDate.dayDefaulted && ' · gün belirtilmemiş, ayın 1\'i varsayıldı'}
                        </span>
                      )}
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Geçerlilik (Yıl)</label>
                      <input
                        type="number"
                        min={1}
                        step={0.5}
                        value={row.validityYears}
                        onChange={(e) => updateRow(row.id, { validityYears: parseFloat(e.target.value) || row.validityYears })}
                        className="w-full border rounded-lg px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 dark:border-slate-700 outline-none focus:ring-1 focus:ring-teal-500"
                      />
                    </div>

                    {row.otherDates.length > 0 && (
                      <div className="md:col-span-4 text-[10px] text-gray-400">
                        Diğer tespit edilen tarihler: {row.otherDates.map((d) => `${d.date} (${d.label})`).join(', ')}
                      </div>
                    )}

                    <div className="md:col-span-4 flex items-center gap-3 pt-1 border-t border-gray-100 dark:border-slate-700 mt-1">
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase border ${STATUS_BADGE_CLASSES[status]}`}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        {expiry ? `Son Geçerlilik: ${expiry}` : 'Son geçerlilik tarihi belirsiz'}
                        {daysRemaining !== null &&
                          (daysRemaining >= 0
                            ? ` · ${daysRemaining} gün kaldı`
                            : ` · ${Math.abs(daysRemaining)} gün geçti`)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="sticky bottom-4 mt-6 bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-lg p-4 flex items-center justify-between gap-3">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {saveProgress
              ? `Kaydediliyor: ${saveProgress.done}/${saveProgress.total}`
              : `${rows.length} dosya listelendi`}
          </span>
          <button
            onClick={handleSaveAll}
            disabled={!canSave}
            className="bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs shadow-md transition disabled:opacity-50 flex items-center gap-2"
          >
            {saving ? <Loader className="animate-spin" size={14} /> : <CheckCircle size={14} />}
            {saving ? 'Kaydediliyor...' : 'Tümünü Kaydet'}
          </button>
        </div>
      )}
    </div>
  );
}
