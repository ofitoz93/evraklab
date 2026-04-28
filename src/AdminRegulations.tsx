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


export default function AdminRegulations() {
  const [regulations, setRegulations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
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
    fetchOrganizations();
  }, []);

  const fetchRegulations = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('regulations').select('*').order('created_at', { ascending: false });
    if (!error && data) setRegulations(data);
    setLoading(false);
  };

  const fetchOrganizations = async () => {
    const { data, error } = await supabase
      .from('organizations')
      .select('id, name')
      .order('name', { ascending: true });
    
    if (!error && data) {
      setOrganizations(data);
    }
  };

  const handleSaveRegulation = async () => {
    if (!formData.title) return alert('Başlık zorunludur!');
    const payload = {
      title: formData.title,
      publication_date: formData.publication_date || null,
      rg_no: formData.rg_no || null,
      rg_date: formData.rg_date || null,
      effective_date: formData.effective_date || null
    };

    const { error } = await supabase.from('regulations').insert([payload]);
    if (!error) {
      alert('Mevzuat başarıyla eklendi.');
      setIsAddModalOpen(false);
      setFormData({ title: '', publication_date: '', rg_no: '', rg_date: '', effective_date: '' });
      fetchRegulations();
    } else {
      alert('Hata oluştu: ' + error.message);
    }
  };

  const deleteRegulation = async (id: string) => {
    if (!window.confirm('Bu mevzuatı silmek istediğinize emin misiniz?')) return;
    await supabase.from('regulations').delete().eq('id', id);
    fetchRegulations();
  };

  // --- ARTICLES PANEL ---
  const openArticlesModal = async (regulation: any) => {
    setSelectedRegulation(regulation);
    setIsArticlesModalOpen(true);
    fetchArticles(regulation.id);
  };

  const fetchArticles = async (regId: string) => {
    const { data, error } = await supabase
      .from('regulation_articles')
      .select('*')
      .eq('regulation_id', regId)
      .order('order_index', { ascending: true });
    if (!error && data) setArticles(data);
  };

  const handleAddArticle = async () => {
    if(!newArticleData.content) return alert('İçerik boş olamaz');
    const { error } = await supabase.from('regulation_articles').insert([{
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
    await supabase.from('regulation_articles').delete().eq('id', id);
    fetchArticles(selectedRegulation.id);
  };

  // --- PDF PARSING (BROWSER-BASED) ---
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPdf(true);

    try {
      // 1. Tarayıcı içinde PDF Dosyasını Oku
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      let fullText = '';
      
      // 2. Tüm Sayfalardaki Metinleri Çıkar
      for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          
          // Satır boşluklarını ve kelimeleri makul şekilde birleştir
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n\n';
      }

      // 3. Yüksek Zekalı Mevzuat Ayrıştırma Modeli
      // Kompleks Lookahead Regex: BÖLÜM, MADDE, GEÇİCİ MADDE, EK MADDE ve KISIM'ları yakalar
      const rgx = /(?=(?:BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU|ONUNCU)\s+(?:BÖLÜM|KISIM)|\bGEÇİCİ\s+MADDE\s+\d+|\bEK\s+MADDE\s+\d+|\bMADDE\s+\d+)/gi;
      const blocks = fullText.split(rgx);
      
      const parsedArticles: any[] = [];
      let ord = 0;

      blocks.forEach((block) => {
         const txt = block.trim();
         if (txt.length < 3) return;

         let no = '';
         let title = '';
         let content = txt;

         // Bölüm Kısım kontrolü
         const isSection = txt.match(/^((?:BİRİNCİ|İKİNCİ|ÜÇÜNCÜ|DÖRDÜNCÜ|BEŞİNCİ|ALTINCI|YEDİNCİ|SEKİZİNCİ|DOKUZUNCU|ONUNCU)\s+(?:BÖLÜM|KISIM))(.*?)$/is);
         const isArticle = txt.match(/^((?:GEÇİCİ\s+|EK\s+)?MADDE\s+\d+)(.*?)(?:-|\.|–|\n)(.*?)$/is);

         if (isSection) {
             no = 'BÖLÜM';
             const lines = txt.split('\n');
             title = lines[0].trim();
             if (lines.length > 1 && lines[1].length < 150) title += ' - ' + lines[1].trim(); 
             content = txt;
         } else if (isArticle) {
             no = isArticle[1].trim().toUpperCase(); // örn: GEÇİCİ MADDE 1
             title = no; // Geçici olarak atayalım, başlığı önceki bloktan çekeceğiz
             content = txt;

             // Önceki Bloktan (veya satırdan) Gizli Başlığı Çekme Algoritması
             if (parsedArticles.length > 0) {
                 const prev = parsedArticles[parsedArticles.length - 1];
                 const prevLines = prev.content.split('\n');
                 if (prevLines.length > 1) {
                     const lastLine = prevLines[prevLines.length - 1].trim();
                     // Eğer son satır kısa bir başlıksa ve içinde doğrudan Madde geçmiyorsa
                     if (lastLine.length > 2 && lastLine.length < 150 && !lastLine.toUpperCase().includes('MADDE')) {
                         title = lastLine;
                         // Önceki maddenin içeriğinden başlığı temizle
                         prev.content = prevLines.slice(0, prevLines.length - 1).join('\n').trim();
                     }
                 }
             }
         } else {
             no = parsedArticles.length === 0 ? 'GİRİŞ' : 'METİN';
             title = parsedArticles.length === 0 ? 'Amaç, Kapsam ve Dayanak' : 'Ek Metin';
             content = txt;
         }

         parsedArticles.push({
            regulation_id: selectedRegulation.id,
            article_no: no,
            title: title.length > 150 ? title.substring(0,150)+'...' : title,
            content: content,
            order_index: ord++
         });
      });

      if (parsedArticles.length > 0) {
        // En fazla 50 şer 50 şer atalım ki Supabase payload limiti aşılmasın
        const batchSize = 50;
        for (let i = 0; i < parsedArticles.length; i += batchSize) {
           const batch = parsedArticles.slice(i, i + batchSize);
           await supabase.from('regulation_articles').insert(batch);
        }
        
        alert(`Tarayıcı ile PDF başarıyla okundu! ${parsedArticles.length} madde çıkarıldı.`);
        fetchArticles(selectedRegulation.id);
      } else {
        alert('Regex hiçbir madde yakalayamadı. Mevzuat formatı uygun olmayabilir, düz metin eklendi.');
        // Yedek olarak tüm metni tek bir madde olarak at
        await supabase.from('regulation_articles').insert([{
           regulation_id: selectedRegulation.id,
           article_no: 'TÜMÜ',
           title: 'PDF Tam Metin',
           content: fullText.substring(0, 30000), // Max text sınırı vs
           order_index: articles.length
        }]);
        fetchArticles(selectedRegulation.id);
      }
    } catch (err: any) {
      console.error("PDF İşleme Hatası:", err);
      alert('PDF Okuma Hatası: Lütfen dosyanın şifreli olmadığından ve metin tabanlı olduğundan emin olun.');
    } finally {
      setIsUploadingPdf(false);
      // Inputu resetle ki aynı dosyayı bir daha seçebilsin
      e.target.value = '';
    }
  };

  // --- ASSIGNMENTS ---
  const openAssignModal = async (regulation: any) => {
    setSelectedRegulation(regulation);
    setIsAssignModalOpen(true);
    const { data } = await supabase.from('company_regulations').select('*').eq('regulation_id', regulation.id);
    if(data) {
       setAssignedOrgs(data.map(d => d.organization_id));
    }
  };

  const toggleOrgAssignment = async (orgId: string) => {
     if (assignedOrgs.includes(orgId)) {
        await supabase.from('company_regulations').delete().eq('regulation_id', selectedRegulation.id).eq('organization_id', orgId);
        setAssignedOrgs(assignedOrgs.filter(id => id !== orgId));
     } else {
        const {data: {user}} = await supabase.auth.getUser();
        await supabase.from('company_regulations').insert([{ regulation_id: selectedRegulation.id, organization_id: orgId, assigned_by: user?.id }]);
        setAssignedOrgs([...assignedOrgs, orgId]);
     }
  };


  if (loading) return <div className="p-8">Yükleniyor...</div>;

  return (
    <div className="p-4 md:p-6 mb-20 md:mb-0 max-w-6xl mx-auto animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="text-blue-600" />
            Mevzuat ve Yönetmelik Havuzu (Sistem Yöneticisi)
          </h1>
          <p className="text-gray-500 dark:text-gray-400">Merkezi mevzuat kütüphanesini yönetin</p>
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
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Mevzuat Adı</th>
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Yayım Tarihi</th>
              <th className="text-left py-3 px-4 font-bold text-gray-700 dark:text-gray-300">Yürürlük Tarihi</th>
              <th className="text-right py-3 px-4 font-bold text-gray-700 dark:text-gray-300">İşlemler</th>
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
                      <Building size={14} /> Firmalara Ata
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
                    <td colSpan={4} className="py-8 text-center text-gray-500">Kayıtlı mevzuat bulunamadı.</td>
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
                <label className="block text-sm font-medium mb-1">Mevzuat Adı (*)</label>
                <input 
                  type="text" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600" 
                  value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Yayın Tarihi</label>
                  <input type="date" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.publication_date} onChange={e => setFormData({...formData, publication_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Yürürlük Tarihi</label>
                  <input type="date" className="w-full p-2 border rounded dark:bg-slate-700 dark:border-slate-600"
                   value={formData.effective_date} onChange={e => setFormData({...formData, effective_date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">RG Sayısı</label>
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
              <button className="px-4 py-2 border rounded hover:bg-gray-100 dark:hover:bg-slate-700" onClick={() => setIsAddModalOpen(false)}>İptal</button>
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
                       <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Sisteminize bağlı olan yerel Marker aracı ile yönetmeliği otomatik ayrıştırın.</p>
                   </div>
                   <label className={`cursor-pointer bg-blue-600 text-white px-4 py-2 rounded flex items-center gap-2 hover:bg-blue-700 transition ${isUploadingPdf ? 'opacity-50 cursor-not-allowed' : ''}`}>
                       {isUploadingPdf ? <RefreshCw className="animate-spin" size={16} /> : <FileText size={16} />}
                       {isUploadingPdf ? 'Taranıyor...' : 'PDF Yükle'}
                       <input type="file" className="hidden" accept=".pdf" onChange={handlePdfUpload} disabled={isUploadingPdf} />
                   </label>
               </div>

               {/* Manuel Ekleme */}
               <div className="border p-4 rounded-lg bg-gray-50 dark:bg-slate-700 dark:border-slate-600">
                    <h3 className="font-bold mb-3 flex items-center gap-2">Tek Madde Ekle</h3>
                    <div className="flex flex-col gap-3">
                        <div className="flex gap-3">
                            <input type="text" placeholder="Madde No (Örn: 1)" className="w-1/4 p-2 border rounded"
                             value={newArticleData.article_no} onChange={e => setNewArticleData({...newArticleData, article_no: e.target.value})} />
                             <input type="text" placeholder="Başlık (Opsiyonel)" className="flex-1 p-2 border rounded"
                             value={newArticleData.title} onChange={e => setNewArticleData({...newArticleData, title: e.target.value})} />
                        </div>
                        <textarea placeholder="Madde İçeriği..." className="w-full p-2 border rounded h-20"
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
                  <Building size={20} /> Firmalara Ata
              </h2>
              <button onClick={() => setIsAssignModalOpen(false)}><X size={24} className="text-gray-500" /></button>
            </div>
            
            <p className="text-sm mb-4"><strong>{selectedRegulation.title}</strong> mevzuatını aşağıdaki organizasyonlara tanımlayabilirsiniz.</p>
            
            <div className="space-y-2 max-h-80 overflow-y-auto">
               {organizations.map(org => {
                  const isAssigned = assignedOrgs.includes(org.id);
                  return (
                      <div key={org.id} className="flex items-center justify-between border border-gray-200 dark:border-slate-700 p-3 rounded hover:bg-gray-50 dark:hover:bg-slate-700">
                          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{org.name}</span>
                          <button 
                             onClick={() => toggleOrgAssignment(org.id)}
                             className={`px-3 py-1 text-sm font-bold rounded transiton ${isAssigned ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                           >
                              {isAssigned ? 'Tanımlı (Kaldır)' : 'Ata'}
                          </button>
                      </div>
                  );
               })}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
