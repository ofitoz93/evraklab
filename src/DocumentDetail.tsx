import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  Download,
  Trash2,
  Edit,
  ArrowLeft,
  Calendar,
  MapPin,
  Tag,
  Archive,
  Clock,
  Eye,
  User,
  Lock,
  AlertTriangle,
} from 'lucide-react';

export default function DocumentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<any>(null);
  const [archivedDocs, setArchivedDocs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    fetchDocAndArchives();
  }, [id]);

  const fetchDocAndArchives = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return navigate('/');

    // 1. Kullanıcı Profilini ve Yetkilerini Çek
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role, permissions')
      .eq('id', session.user.id)
      .single();

    const myOrgId = profile?.organization_id;
    const isSystemAdmin = profile?.role === 'admin';

    // 2. Ana Belgeyi Çek
    const { data: mainDoc } = await supabase
      .from('documents')
      .select(
        `
            *, 
            type_def:user_definitions!type_def_id(label), 
            location_def:user_definitions!location_def_id(label),
            uploader:profiles!uploader_id(full_name)
        `
      )
      .eq('id', id)
      .single();

    if (!mainDoc) {
      setLoading(false);
      return;
    }

    // 3. GÜVENLİK KONTROLÜ (Erişim Yetkisi Var mı?)
    if (!isSystemAdmin) {
      const isMyDoc = mainDoc.uploader_id === session.user.id;
      const isCorporateDoc = !!mainDoc.organization_id;

      let canSee = false;

      if (!isCorporateDoc) {
        // Şahsi Belge: Sadece yükleyen (sahibi) görebilir
        if (isMyDoc) canSee = true;
      } else {
        // Kurumsal Belge:
        // Kural A: Belge kullanıcının ŞU ANKİ şirketine mi ait? (Eski şirket evrağını göremez)
        if (myOrgId && mainDoc.organization_id === myOrgId) {
          // Kural B: Şirket aynı, peki rol yetkisi var mı?
          if (isMyDoc) canSee = true; // Kendi yüklediği
          if (
            profile?.role === 'premium_corporate' ||
            profile?.role === 'corporate_chief'
          )
            canSee = true; // Yönetici/Şef
          if (profile?.permissions?.can_view_team_docs) canSee = true; // Yetkili Personel
        }
      }

      if (!canSee) {
        setAccessDenied(true);
        setLoading(false);
        return;
      }
    }

    setDoc(mainDoc);

    // 4. Arşivlenmiş Eski Sürümleri Çek
    // (Sadece ana belgeyi görme yetkisi varsa burası çalışır)
    let query = supabase
      .from('documents')
      .select('*, uploader:profiles!uploader_id(full_name)')
      .eq('is_archived', true)
      .eq('type_def_id', mainDoc.type_def_id);

    // Arşiv filtreleri (Aynı lokasyon ve organizasyon/kişi)
    if (mainDoc.location_def_id)
      query = query.eq('location_def_id', mainDoc.location_def_id);
    else query = query.is('location_def_id', null);

    if (mainDoc.organization_id)
      query = query.eq('organization_id', mainDoc.organization_id);
    else query = query.eq('uploader_id', mainDoc.uploader_id);

    const { data: archives } = await query.order('created_at', {
      ascending: false,
    });
    setArchivedDocs(archives || []);

    setLoading(false);
  };

  const handleDelete = async () => {
    if (
      !window.confirm(
        'Bu belgeyi kalıcı olarak silmek istediğinize emin misiniz?'
      )
    )
      return;
    await supabase.from('documents').delete().eq('id', id);
    navigate('/documents');
  };

  if (loading)
    return (
      <div className="p-10 text-center text-gray-500">
        Belge bilgileri yükleniyor...
      </div>
    );

  // ERİŞİM REDDEDİLDİ EKRANI
  if (accessDenied)
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <div className="bg-red-50 p-6 rounded-full mb-4">
          <Lock size={64} className="text-red-500" />
        </div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Erişim Reddedildi
        </h2>
        <p className="text-gray-500 max-w-md mb-8">
          Bu belgeyi görüntüleme yetkiniz bulunmuyor. Belge şahsi olabilir veya
          artık bağlı olmadığınız bir şirkete ait olabilir.
        </p>
        <button
          onClick={() => navigate('/documents')}
          className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg flex items-center gap-2"
        >
          <ArrowLeft size={20} /> Listeye Dön
        </button>
      </div>
    );

  if (!doc)
    return (
      <div className="p-10 text-center text-gray-500">
        Belge bulunamadı veya silinmiş.
      </div>
    );

  const isExpired = doc.expiry_date && new Date(doc.expiry_date) < new Date();
  const deadline = doc.application_deadline
    ? doc.application_deadline
    : doc.expiry_date;
  const typeName = doc.type_def?.label || 'Genel';
  const locName = doc.location_def?.label || 'Belirtilmemiş';
  const uploaderName = doc.uploader?.full_name || 'Bilinmiyor';

  return (
    <div className="max-w-5xl mx-auto pb-10">
      <button
        onClick={() => navigate('/documents')}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-800 mb-6 font-bold transition"
      >
        <ArrowLeft size={18} /> Listeye Dön
      </button>

      {/* ANA KART */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8">
        <div className="bg-gray-50 p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600 shadow-sm">
              <FileText size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-gray-800 leading-tight">
                {doc.title}
              </h1>

              {/* ETİKETLER */}
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="text-xs uppercase font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded flex items-center gap-1">
                  <Tag size={12} /> {typeName}
                </span>
                <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded flex items-center gap-1 border border-purple-200">
                  <User size={12} /> {uploaderName}
                </span>
                {doc.is_indefinite && (
                  <span className="text-xs uppercase font-bold bg-green-100 text-green-700 px-2 py-1 rounded">
                    SÜRESİZ
                  </span>
                )}
                {doc.organization_id ? (
                  <span className="text-xs uppercase font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded flex items-center gap-1">
                    <User size={12} /> Kurumsal
                  </span>
                ) : (
                  <span className="text-xs uppercase font-bold bg-orange-100 text-orange-700 px-2 py-1 rounded flex items-center gap-1">
                    <User size={12} /> Şahsi
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 md:flex-none bg-blue-600 text-white px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700 text-sm shadow transition"
            >
              <Download size={16} /> İndir
            </a>
            <Link
              to={`/documents/edit/${id}`}
              className="flex-1 md:flex-none bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-gray-50 text-sm transition"
            >
              <Edit size={16} /> Düzenle
            </Link>
            <button
              onClick={handleDelete}
              className="flex-1 md:flex-none bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-100 text-sm transition"
            >
              <Trash2 size={16} /> Sil
            </button>
          </div>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 flex items-center gap-1">
                <MapPin size={14} /> Lokasyon
              </h3>
              <p className="text-gray-800 font-bold text-lg">{locName}</p>
            </div>

            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-3 flex items-center gap-1">
                <Calendar size={14} /> Kritik Tarihler
              </h3>
              <div className="space-y-3 bg-white border rounded-xl p-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <span className="text-gray-600 text-sm font-medium">
                    Alınma Tarihi
                  </span>
                  <span className="font-bold text-gray-800">
                    {new Date(doc.acquisition_date).toLocaleDateString()}
                  </span>
                </div>

                {!doc.is_indefinite && (
                  <>
                    <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                      <span className="text-gray-600 text-sm font-medium">
                        Bitiş Tarihi
                      </span>
                      <span
                        className={`font-bold ${
                          isExpired ? 'text-red-600' : 'text-gray-800'
                        }`}
                      >
                        {doc.expiry_date
                          ? new Date(doc.expiry_date).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm font-medium">
                        Son Başvuru
                      </span>
                      <span className="font-bold text-orange-600">
                        {deadline
                          ? new Date(deadline).toLocaleDateString()
                          : '-'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">
                Açıklama
              </h3>
              <div className="text-gray-700 bg-gray-50 border border-gray-200 p-4 rounded-xl min-h-[120px] text-sm leading-relaxed">
                {doc.description ||
                  'Bu belge için herhangi bir açıklama girilmemiş.'}
              </div>
            </div>

            <a
              href={doc.file_url}
              target="_blank"
              className="block text-center p-4 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl font-bold transition flex items-center justify-center gap-2"
            >
              <Eye size={20} /> Belgeyi Görüntüle (Yeni Sekme)
            </a>
          </div>
        </div>
      </div>

      {/* --- ARŞİVLENMİŞ ESKİ SÜRÜMLER --- */}
      {archivedDocs.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <Archive className="text-gray-400" /> Arşivlenmiş Eski Sürümler
          </h3>
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b text-xs uppercase text-gray-500">
                <tr>
                  <th className="p-4">Belge Adı</th>
                  <th className="p-4">Yükleyen</th>
                  <th className="p-4">Yükleme Tarihi</th>
                  <th className="p-4 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {archivedDocs.map((archive) => (
                  <tr key={archive.id} className="hover:bg-gray-50 transition">
                    <td className="p-4 text-gray-700 font-medium flex items-center gap-2">
                      <Clock size={14} className="text-gray-400" />{' '}
                      {archive.title}
                    </td>
                    <td className="p-4 text-gray-600">
                      {archive.uploader?.full_name}
                    </td>
                    <td className="p-4 text-gray-500">
                      {new Date(archive.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <a
                        href={archive.file_url}
                        target="_blank"
                        className="text-blue-600 hover:text-blue-800 text-xs font-bold flex items-center gap-1 justify-end bg-blue-50 px-2 py-1 rounded w-fit ml-auto"
                      >
                        <Eye size={12} /> Görüntüle
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
