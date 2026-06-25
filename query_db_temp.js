import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { 
  FileText, Plus, Trash2, Edit, Save, 
  X, RefreshCw, Upload, Building, Users
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}


export default function AdminRegulations({ restrictedOrgId }: { restrictedOrgId?: string }) {
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([]);
  const [isAllCompanyAssigned, setIsAllCompanyAssigned] = useState(false);
  
  // Modals & States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isArticlesModalOpen, setIsArticlesModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  
  const [selectedRegulation, setSelectedRegulation] = useState<any>(null);
  
  // FormData for New Regulation
  const [formData, setFormData] = useState({
    title: '',
    publication_date: '',
    rg_no: '',
    rg_date: '',
    effective_date: '',
  });

  // Articles
  const [articles, setArticles] = useState<any[]>([]);
  const [newArticleData, setNewArticleData] = useState({ article_no: '', title: '', content: '' });
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);

  // Assignments
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [assignedOrgs, setAssignedOrgs] = useState<any[]>([]); // assigned org IDs

  useEffect(() => {
    fetchRegulations();
    if (restrictedOrgId) {
      fetchCompanyEmployees();
    } else {
      fetchOrganizations();
    }
  }, [restrictedOrgId]);

  const fetchRegulations = async () => {
    setLoading(true);
    try {
      let query = supabase.from('pdf_regulations').select('*').order('created_at', { ascending: false });
      
      if (restrictedOrgId) {
        query = query.eq('organization_id', restrictedOrgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setRegulations(data || []);
    } catch (err: any) {
      console.warn("Mevzuat listesi ├ğekilemedi, sade liste deneniyor...", err.message);
      const { data: basicData } = await supabase.from('pdf_regulations').select('*');
      setRegulations(basicData || []);
    }
    setLoading(false);
  };

  const fetchCompanyEmployees = async () => {
    if (!restrictedOrgId) return;
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('organization_id', restrictedOrgId)
      .order('full_name');
    setCompanyEmployees(data || []);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setOrganizations(data);
    }
  };

  const handleSaveRegulation = async () => {
    if (!formData.title) return alert('Ba┼şl─▒k zorunludur!');
    const { data: { session } } = await supabase.auth.getSession();
    const payload = {
      title: formData.title,
      publication_date: formData.publication_date || null,
      rg_no: formData.rg_no || null,
      rg_date: formData.rg_date || null,
      effective_date: formData.effective_date || null,
      company_id: restrictedOrgId || null,
      created_by: session?.user?.id || null
    };

    const { data: savedReg, error } = await supabase
      .from('pdf_regulations')
      .insert([payload])
      .select()
      .single();

    if (!error && savedReg) {
      // ┼Şirket y├Âneticisi ekledi ÔåÆ kendine otomatik ata (├ğal─▒┼şanlar g├Âremez, sadece y├Ânetici)
      if (restrictedOrgId && session?.user?.id) {
        await supabase.from('user_pdf_regulations').insert([{
          user_id: session.user.id,
          regulation_id: savedReg.id,
          assigned_by: session.user.id
        }]);
      }
      alert('Mevzuat ba┼şar─▒yla eklendi.');
      setIsAddModalOpen(false);
      setFormData({ title: '', publication_date: '', rg_no: '', rg_date: '', effective_date: '' });
      fetchRegulations();
    } else {
      alert('Hata olu┼ştu: ' + (error?.message || 'Bilinmeyen hata'));
    }
  };

  const deleteRegulation = async (id: string) => {
    if (!window.confirm('Bu mevzuat─▒ silmek istedi─şinize emin misiniz?')) return;
    await supabase.from('pdf_regulations').delete().eq('id', id);
    fetchRegulations();
  };

  // --- ARTICLES PANEL ---
  const openArticlesModal = async (regulation: any) => {
    setSelectedRegulation(regulation);
    setIsArticlesModalOpen(true);
    fetchArticles(regulation.id);
  };

  const fetchArticles = async (regId: string) => {
    const { data } = await supabase.from('pdf_articles').select('*').eq('regulation_id', regId).order('order_index', { ascending: true });
    setArticles(data || []);
  };

  const handleAddArticle = async () => {
    if(!newArticleData.content) return alert('─░├ğerik bo┼ş olamaz');
    const { error } = await supabase.from('pdf_articles').insert([{
      regulation_id: selectedRegulation.id,
      ...newArticleData,
      order_index: articles.length
    }]);
    if(!error) {
      setNewArticleData({ article_no: '', title: '', content: '' });
      fetchArticles(selectedRegulation.id);
    }
  };

  const deleteArticle = async (id: string) => {
    await supabase.from('pdf_articles').delete().eq('id', id);
    if (selectedRegulation) fetchArticles(selectedRegulation.id);
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      // T├╝m sayfalar─▒ sat─▒r bazl─▒ ├ğek (y pozisyonuna g├Âre s─▒rala)
      let lines: string[] = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        // Y koordinat─▒na g├Âre grupla (ayn─▒ sat─▒rdaki itemlar)
        const lineMap = new Map<number, string[]>();
        textContent.items.forEach((item: any) => {
          const y = Math.round(item.transform[5]);
          if (!lineMap.has(y)) lineMap.set(y, []);
          lineMap.get(y)!.push(item.str);
        });
        
        // Y'ye g├Âre ters s─▒rala (├╝stten alta)
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);
        sortedYs.forEach(y => {
          const lineText = lineMap.get(y)!.join(' ').trim();
          if (lineText) lines.push(lineText);
        });
      }

      // Madde ba┼şl─▒─ş─▒ regex'i
      const ARTICLE_REGEX = /^((?:GE├ç─░C─░\s+|EK\s+)?MADDE\s+\d+)\s*[ÔÇô\-ÔÇö.]?\s*(.*)?$/i;
      const SECTION_REGEX = /^((?:B─░R─░NC─░|─░K─░NC─░|├£├ç├£NC├£|D├ûRD├£NC├£|BE┼Ş─░NC─░|ALTINCI|YED─░NC─░|SEK─░Z─░NC─░|DOKUZUNCU|ONUNCU)\s+(?:B├ûL├£M|KISIM))\s*(.*)$/i;

      const parsedArticles: any[] = [];
      let ord = 0;
      let currentNo = 'G─░R─░┼Ş';
      let currentTitle = 'Giri┼ş';
      let currentContent: string[] = [];
      let pendingTitle = ''; // Bir sonraki maddenin ba┼şl─▒─ş─▒ (genellikle madde numaras─▒ndan ├Ânceki sat─▒rda olur)

      const flushCurrent = () => {
        const fullContent = currentContent.join('\n').trim();
        if (fullContent.length < 5) {
          currentContent = [];
          return;
        }

        // Madde i├ğeri─şini bentlere ay─▒r (a), b), 1), 2) gibi)
        // Regex: Sat─▒r ba┼ş─▒nda "a)" veya "1)" gibi ifadeleri yakalar
        const BENT_REGEX = /^(\s*(?:[a-z├ğ─ş─▒├Â┼şu├╝])\)|(?:\d+)\))\s+(.*)$/im;
        const parts = fullContent.split(/^(\s*(?:[a-z├ğ─ş─▒├Â┼şu├╝])\)|(?:\d+)\))\s+/im);
        
        if (parts.length > 1) {
          // ─░lk par├ğa maddenin ana metni (varsa)
          if (parts[0].trim().length > 5) {
            parsedArticles.push({
              regulation_id: selectedRegulation.id,
              article_no: currentNo,
              title: currentTitle,
              content: parts[0].trim(),
              order_index: ord++
            });
          }

          // Sonraki par├ğalar (bentler)
          for (let k = 1; k < parts.length; k += 2) {
            const bentNo = parts[k].trim();
            const bentContent = parts[k+1]?.trim() || '';
            if (bentContent) {
              parsedArticles.push({
                regulation_id: selectedRegulation.id,
                article_no: `${currentNo} / ${bentNo}`,
                title: `${currentTitle} (${bentNo})`,
                content: bentContent,
                order_index: ord++
              });
            }
          }
        } else {
          // Bent yoksa d├╝z kaydet
          parsedArticles.push({
            regulation_id: selectedRegulation.id,
            article_no: currentNo,
            title: currentTitle.length > 200 ? currentTitle.substring(0, 200) : currentTitle,
            content: fullContent,
            order_index: ord++
          });
        }
        currentContent = [];
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const sectionMatch = line.match(SECTION_REGEX);
        const articleMatch = line.match(ARTICLE_REGEX);

        if (sectionMatch) {
          flushCurrent();
          currentNo = 'B├ûL├£M';
          currentTitle = sectionMatch[1].trim() + (sectionMatch[2] ? ' - ' + sectionMatch[2].trim() : '');
          pendingTitle = '';
          currentContent = [];
        } else if (articleMatch) {
          flushCurrent();
          currentNo = articleMatch[1].trim().toUpperCase();
          // Ba┼şl─▒k: e─şer pending varsa kullan, yoksa madde numaras─▒n─▒n yan─▒ndaki metni al
          const inlineTitle = articleMatch[2]?.trim() || '';
          if (pendingTitle && pendingTitle.length < 150) {
            currentTitle = pendingTitle;
          } else if (inlineTitle && inlineTitle.length < 150) {
            currentTitle = inlineTitle;
          } else {
            currentTitle = currentNo;
          }
          pendingTitle = '';
          // Maddede inline i├ğerik varsa ekle
          if (inlineTitle && inlineTitle !== currentTitle) {
            currentContent.push(inlineTitle);
          }
        } else {
          // Bu sat─▒r bir sonraki maddenin ba┼şl─▒─ş─▒ m─▒? (k─▒sa ve b├╝y├╝k harf a─ş─▒rl─▒kl─▒)
          const isLikelyTitle = line.length < 100 && line === line.toUpperCase() && !/\d/.test(line.slice(-1));
          if (isLikelyTitle) {
            pendingTitle = line;
          }
          currentContent.push(line);
        }
      }
      // Son maddeyi flush et
      flushCurrent();



      if (parsedArticles.length > 0) {
        // En fazla 50 ┼şer 50 ┼şer atal─▒m ki Supabase payload limiti a┼ş─▒lmas─▒n
        const batchSize = 50;
        for (let i = 0; i < parsedArticles.length; i += batchSize) {
           const batch = parsedArticles.slice(i, i + batchSize);
           await supabase.from('pdf_articles').insert(batch);
        }
        
        alert(`Taray─▒c─▒ ile PDF ba┼şar─▒yla okundu! ${parsedArticles.length} madde ├ğ─▒kar─▒ld─▒.`);
        fetchArticles(selectedRegulation.id);
      } else {
        alert('PDF tam metin olarak eklendi.');
        const allText = lines.join(' ').substring(0, 30000);
        await supabase.from('pdf_articles').insert([{
           regulation_id: selectedRegulation.id,
           article_no: 'T├£M├£',
           title: 'PDF Tam Metin',
           content: allText,
           order_index: articles.length
        }]);
        fetchArticles(selectedRegulation.id);
      }
    } catch (err: any) {
      console.error("PDF ─░┼şleme Hatas─▒:", err);
      alert('PDF Okuma Hatas─▒: L├╝tfen dosyan─▒n ┼şifreli olmad─▒─ş─▒ndan ve metin tabanl─▒ oldu─şundan emin olun.');
    } finally {
      setIsUploadingPdf(false);
      // Inputu resetle ki ayn─▒ dosyay─▒ bir daha se├ğebilsin
      e.target.value = '';
    }
  };

  // --- ASSIGNMENTS ---
  const openAssignModal = async (regulation: any) => {
    setSelectedRegulation(regulation);
    
    if (restrictedOrgId) {
      // Firma i├ğindeki atamalar─▒ kontrol et
      const { data: users } = await supabase.from('user_pdf_regulations').select('user_id').eq('regulation_id', regulation.id);
      setAssignedOrgs(users?.map(u => u.user_id) || []);
      
      const { data: comp } = await supabase.from('company_pdf_regulations').select('*').eq('regulation_id', regulation.id).eq('company_id', restrictedOrgId);
      setIsAllCompanyAssigned(!!(comp && comp.length > 0));
    } else {
      const { data } = await supabase.from('company_pdf_regulations').select('company_id').eq('regulation_id', regulation.id);
      setAssignedOrgs(data?.map(d => d.company_id) || []);
    }
    
    setIsAssignModalOpen(true);
  };

  const handleToggleAssign = async (targetId: string) => {
    const isCurrentlyAssigned = assignedOrgs.includes(targetId);
    
    if (restrictedOrgId) {
      // User level assignment
      if (isCurrentlyAssigned) {
        await supabase.from('user_pdf_regulations').delete().eq('regulation_id', selectedRegulation.id).eq('user_id', targetId);
      } else {
        await supabase.from('user_pdf_regulations').insert([{ regulation_id: selectedRegulation.id, user_id: targetId }]);
      }
    } else {
      // Company level assignment
      if (isCurrentlyAssigned) {
        await supabase.from('company_pdf_regulations').delete().eq('regulation_id', selectedRegulation.id).eq('company_id', targetId);
      } else {
        await supabase.from('company_pdf_regulations').insert([{ regulation_id: selectedRegulation.id, company_id: targetId }]);
      }
    }
    
    openAssignModal(selectedRegulation);
  };

  const toggleAllCompanyAccess = async () => {
    if (!restrictedOrgId || !selectedRegulation) return;
    
    if (isAllCompanyAssigned) {
      await supabase.from('company_pdf_regulations').delete().eq('regulation_id', selectedRegulation.id).eq('company_id', restrictedOrgId);
    } else {
      await supabase.from('company_pdf_regulations').insert([{ regulation_id: selectedRegulation.id, company_id: restrictedOrgId }]);
    }
    openAssignModal(selectedRegulation);
  };

  if (loading) return <div className="p-8">Y├╝kleniyor...</div>;

  return (
    <div className="p-4 md:p-6 mb-20 md:mb-0 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-blue-600" />
            Mevzuat ve Y├Ânetmelik Havuzu (Sistem Y├Âneticisi)
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Merkezi mevzuat k├╝t├╝phanesini y├Ânetin</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={18} /> Yeni Mevzuat Ekle
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-gray-200 dark:border-slate-700 mb-6 overflow-x-auto">
        <table className="w-full whitespace-nowrap">
          <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Mevzuat Ad─▒</th>
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Yay─▒m Tarihi</th>
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Y├╝r├╝rl├╝k Tarihi</th>
              <th className="text-right py-3 px-4 font-bold text-gray-700 dark:text-gray-300">─░┼şlemler</th>
            </tr>
          </thead>
          <tbody>
            {regulations.map(reg => (
              <tr key={reg.id} className="border-b border-gray-50 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700/50">
                <td className="py-3 px-4">{reg.title}</td>
                <td className="py-3 px-4">{reg.publication_date || '-'}</td>
                <td className="py-3 px-4">{reg.effective_date || '-'}</td>
                <td className="py-3 px-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => openArticlesModal(reg)} className="text-sm bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400 px-3 py-1 rounded hover:bg-indigo-100 transition flex items-center gap-1">
                      <FileText size={14} /> Maddeler
                    </button>
                    <button onClick={() => openAssignModal(reg)} className="text-sm bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 px-3 py-1 rounded hover:bg-green-100 transition flex items-center gap-1">
                      {restrictedOrgId ? <><Users size={14} /> ├çal─▒┼şanlara Ata</> : <><Building size={14} /> Firmalara Ata</>}
                    </button>
                    <button onClick={() => deleteRegulation(reg.id)} className="text-sm bg-red-50 text-red-600 px-3 py-1 rounded hover:bg-red-100 transition">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {regulations.length === 0 && (
                <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500">Kay─▒tl─▒ mevzuat bulunamad─▒.</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ADD REGULATION MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Yeni Mevzuat</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Mevzuat Ad─▒ (*)</label>
                <input 
                  type="text" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" 
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Yay─▒n Tarihi</label>
                  <input type="date" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.publication_date} onChange={e => setFormData({...formData, publication_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Y├╝r├╝rl├╝k Tarihi</label>
                  <input type="date" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.effective_date} onChange={e => setFormData({...formData, effective_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RG Say─▒s─▒</label>
                  <input type="text" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.rg_no} onChange={e => setFormData({...formData, rg_no: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RG Tarihi</label>
                  <input type="date" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.rg_date} onChange={e => setFormData({...formData, rg_date: e.target.value})} />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => setIsAddModalOpen(false)}>─░ptal</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700" onClick={handleSaveRegulation}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* ARTICLES MODAL */}
      {isArticlesModalOpen && selectedRegulation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-4 pb-3 border-b dark:border-slate-700">
              <h2 className="text-xl font-bold flex flex-col">
                <span className="text-sm font-normal text-gray-500">Maddeler</span>
                {selectedRegulation.title}
              </h2>
              <button onClick={() => setIsArticlesModalOpen(false)} className="text-gray-500 hover:text-gray-800">
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                {/* PDF Aktarma */}
               <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-lg flex items-center justify-between">
                   <div>
                       <h3 className="font-bold flex items-center gap-2">
                           <Upload size={18} /> Marker ile PDF'den Aktar
                       </h3>
                       <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sisteminize ba─şl─▒ olan yerel Marker arac─▒ ile y├Ânetmeli─şi otomatik ayr─▒┼şt─▒r─▒n.</p>
                   </div>
                   <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}>
                       {isUploadingPdf ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={16} />}
                       {isUploadingPdf ? 'Taran─▒yor...' : 'PDF Y├╝kle'}
                       <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={isUploadingPdf} />
                   </label>
               </div>

               {/* Manuel Ekleme */}
               <div className="border p-4 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600">
                    <h3 className="font-bold mb-3 flex items-center gap-2">Tek Madde Ekle</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <input type="text" placeholder="Madde No (├ûrn: 1)" className="w-1/4 p-2 border rounded"
                             value={newArticleData.article_no} onChange={e => setNewArticleData({...newArticleData, article_no: e.target.value})} />
                             <input type="text" placeholder="Ba┼şl─▒k (Opsiyonel)" className="flex-1 p-2 border rounded"
                             value={newArticleData.title} onChange={e => setNewArticleData({...newArticleData, title: e.target.value})} />
                        </div>
                        <textarea placeholder="Madde ─░├ğeri─şi..." className="w-full p-2 border rounded h-20"
                         value={newArticleData.content} onChange={e => setNewArticleData({...newArticleData, content: e.target.value})} />
                         <div className="flex justify-end">
                             <button onClick={handleAddArticle} className="bg-green-600 text-white px-4 py-1.5 rounded hover:bg-green-700 text-sm">
                                 Ekle
                             </button>
                         </div>
                    </div>
               </div>

               {/* Liste */}
               <div>
                   {articles.map((art, idx) => (
                       <div key={art.id} className="border-b py-3 flex gap-4 pr-2">
                           <div className="w-16 text-slate-500 font-bold shrink-0">{art.article_no ? `Madde ${art.article_no}` : `#${idx+1}`}</div>
                           <div className="flex-1 text-sm whitespace-pre-wrap">{art.content}</div>
                           <button onClick={() => deleteArticle(art.id)} className="text-red-500 self-start p-1 hover:bg-red-50 rounded shrink-0">
                               <Trash2 size={16} />
                           </button>
                       </div>
                   ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ASSIGN MODAL */}
      {isAssignModalOpen && selectedRegulation && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                  {restrictedOrgId ? <Users size={20} /> : <Building size={20} />} 
                  {restrictedOrgId ? '├çal─▒┼şanlara Ata' : 'Firmalara Ata'}
              </h2>
              <button onClick={() => setIsAssignModalOpen(false)}><X size={24} className="text-gray-500" /></button>
            </div>
            
            <p className="text-sm mb-4"><strong>{selectedRegulation.title}</strong> mevzuat─▒n─▒ a┼şa─ş─▒daki {restrictedOrgId ? '├ğal─▒┼şanlara' : 'organizasyonlara'} tan─▒mlayabilirsiniz.</p>
            
            {restrictedOrgId && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5" 
                    checked={isAllCompanyAssigned}
                    onChange={toggleAllCompanyAccess}
                  />
                  <div>
                    <span className="font-bold text-sm block">T├╝m ┼Şirkete Yay─▒nla</span>
                    <span className="text-[10px] text-gray-500">─░┼şaretlerseniz t├╝m ├ğal─▒┼şanlar otomatik olarak g├Ârebilir.</span>
                  </div>
                </label>
              </div>
            )}

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {restrictedOrgId ? (
                companyEmployees.map(emp => {
                  const isAssigned = assignedOrgs.includes(emp.id);
                  return (
                    <div key={emp.id} className="flex items-center justify-between border border-gray-200 dark:border-slate-700 p-3 rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                      <div className="text-sm">
                        <div className="font-bold">{emp.full_name}</div>
                        <div className="text-[10px] text-gray-500">{emp.email}</div>
                      </div>
                      <button 
                         onClick={() => handleToggleAssign(emp.id)}
                         className={`px-3 py-1 text-xs font-bold rounded transition ${isAssigned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                       >
                          {isAssigned ? 'Tan─▒ml─▒ (Kald─▒r)' : 'Ata'}
                      </button>
                    </div>
                  );
                })
              ) : (
                organizations.map(org => {
                  const isAssigned = assignedOrgs.includes(org.id);
                  return (
                    <div key={org.id} className="flex items-center justify-between border border-gray-200 dark:border-slate-700 p-3 rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                      <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{org.name}</span>
                      <button 
                         onClick={() => handleToggleAssign(org.id)}
                         className={`px-3 py-1 text-xs font-bold rounded transition ${isAssigned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                       >
                          {isAssigned ? 'Tan─▒ml─▒ (Kald─▒r)' : 'Ata'}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
