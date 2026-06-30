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
  MapPin,
  Tag,
  Loader,
  PlusCircle,
  Trash,
  X,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  BarChart2,
  Check,
  ChevronRight
} from 'lucide-react';
import { WASTE_CODES, RECOVERY_CODES, DISPOSAL_CODES } from './wasteCodes';
import { MapPickerModal } from './MapPickerModal';

interface Client {
  id: string;
  name: string;
}

interface WasteCompany {
  id: string;
  name: string;
  type: 'transporter' | 'destination';
  address?: string;
  latitude?: number;
  longitude?: number;
}

interface WasteRecord {
  id: string;
  client_id: string;
  waste_code: string;
  exit_date: string;
  quantity_kg: number;
  transporter?: string;
  transporter_address?: string;
  destination?: string;
  destination_address?: string;
  transporter_id?: string;
  destination_id?: string;
  disposal_type: 'recovery' | 'disposal';
  disposal_code?: string;
  description?: string;
  created_by?: string;
  created_at?: string;
  client?: { name: string };
  creator?: { full_name: string };
  transporter_company?: any;
  destination_company?: any;
}

export default function WasteManagement() {
  // Authentication & Profile states
  const [myProfile, setMyProfile] = useState<any>(null);
  const [myOrg, setMyOrg] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Clients
  const [assignedClients, setAssignedClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  // Waste states
  const [wasteRecords, setWasteRecords] = useState<WasteRecord[]>([]);
  const [loadingWaste, setLoadingWaste] = useState(false);
  const [isWasteTableMissing, setIsWasteTableMissing] = useState(false);

  // Company (Transporter & Destination) states
  const [wasteCompanies, setWasteCompanies] = useState<WasteCompany[]>([]);
  const [showAddCompanyModal, setShowAddCompanyModal] = useState(false);
  const [newCompanyType, setNewCompanyType] = useState<'transporter' | 'destination'>('transporter');
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyAddress, setNewCompanyAddress] = useState('');
  const [newCompanyLat, setNewCompanyLat] = useState<number | null>(null);
  const [newCompanyLng, setNewCompanyLng] = useState<number | null>(null);
  const [submittingCompany, setSubmittingCompany] = useState(false);
  const [showCompanyMap, setShowCompanyMap] = useState(false);

  // Add Waste Shipment states
  const [showAddWasteModal, setShowAddWasteModal] = useState(false);
  const [newWasteClientId, setNewWasteClientId] = useState('');
  const [newWasteCode, setNewWasteCode] = useState('');
  const [newWasteExitDate, setNewWasteExitDate] = useState(new Date().toISOString().split('T')[0]);
  const [newWasteQuantity, setNewWasteQuantity] = useState('');
  const [newWasteTransporterId, setNewWasteTransporterId] = useState('');
  const [newWasteDestinationId, setNewWasteDestinationId] = useState('');
  const [newWasteDisposalType, setNewWasteDisposalType] = useState<'recovery' | 'disposal'>('recovery');
  const [newWasteDisposalCode, setNewWasteDisposalCode] = useState('');
  const [newWasteDescription, setNewWasteDescription] = useState('');
  const [submittingWaste, setSubmittingWaste] = useState(false);

  // Edit Waste Shipment states
  const [showEditWasteModal, setShowEditWasteModal] = useState(false);
  const [editingWasteId, setEditingWasteId] = useState('');
  const [editWasteClientId, setEditWasteClientId] = useState('');
  const [editWasteCode, setEditWasteCode] = useState('');
  const [editWasteExitDate, setEditWasteExitDate] = useState('');
  const [editWasteQuantity, setEditWasteQuantity] = useState('');
  const [editWasteTransporterId, setEditWasteTransporterId] = useState('');
  const [editWasteDestinationId, setEditWasteDestinationId] = useState('');
  const [editWasteDisposalType, setEditWasteDisposalType] = useState<'recovery' | 'disposal'>('recovery');
  const [editWasteDisposalCode, setEditWasteDisposalCode] = useState('');
  const [editWasteDescription, setEditWasteDescription] = useState('');
  const [updatingWaste, setUpdatingWaste] = useState(false);

  // Filter & Search states
  const [wasteSearchQuery, setWasteSearchQuery] = useState('');
  const [wasteFilterType, setWasteFilterType] = useState<'all' | 'recovery' | 'disposal'>('all');

  // Report Modal states
  const [showReportModal, setShowReportModal] = useState(false);
  const [selectedReportClientId, setSelectedReportClientId] = useState('');
  const [reportPeriodType, setReportPeriodType] = useState<'all' | 'monthly' | 'yearly'>('all');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().substring(0, 7));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [generatingReport, setGeneratingReport] = useState(false);

  // Role helpers
  const isConsultant = myProfile && (
    myProfile.role === 'admin' ||
    myProfile.role === 'system_admin' ||
    myProfile.role === 'corporate_chief' ||
    myProfile.role === 'corporate_staff' ||
    !!myProfile.organization?.is_environmental_consultant
  );

  useEffect(() => {
    fetchProfileAndData();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchWasteRecords(selectedClientId);
    } else {
      setWasteRecords([]);
    }
  }, [selectedClientId]);

  const fetchProfileAndData = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        let orgData = null;
        if (profile.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single();
          orgData = org;
        }
        const combinedProfile = { ...profile, organization: orgData };
        setMyProfile(combinedProfile);
        setMyOrg(orgData);

        // 2. Fetch Assigned Clients
        const isConsultantUser = !!orgData?.is_environmental_consultant ||
          ['premium_corporate', 'corporate_chief', 'corporate_staff', 'admin', 'system_admin'].includes(profile.role);
        
        let clientsList: Client[] = [];
        if (isConsultantUser) {
          const canViewAll = profile.role === 'premium_corporate' || profile.role === 'admin' || profile.role === 'system_admin' || !!profile.permissions?.can_view_all_clients;
          if (canViewAll && orgData) {
            const { data } = await supabase
              .from('consultant_clients')
              .select('id, name')
              .eq('consultant_company_id', orgData.id);
            clientsList = data || [];
          } else {
            const { data } = await supabase
              .from('consultant_assignments')
              .select('client_id, client:consultant_clients(id, name)')
              .eq('user_id', profile.id);
            clientsList = data?.map((a: any) => a.client).filter(Boolean) || [];
          }
        } else {
          // Standard client company
          const { data: ccList } = await supabase
            .from('consultant_clients')
            .select('id, name');
          
          let clientRec = null;
          if (ccList && ccList.length > 0 && orgData) {
            const cleanOrgName = orgData.name.trim().toLowerCase();
            clientRec = ccList.find((c: any) => {
              const cleanClientName = c.name.trim().toLowerCase();
              return cleanClientName.includes(cleanOrgName) || cleanOrgName.includes(cleanClientName);
            });
            if (!clientRec) {
              clientRec = ccList[0];
            }
          }
          if (clientRec) {
            clientsList = [clientRec];
          }
        }
        
        setAssignedClients(clientsList);
        if (clientsList.length > 0) {
          setSelectedClientId(clientsList[0].id);
        }

        // 3. Fetch waste companies registered under this organization
        if (orgData) {
          fetchWasteCompanies(orgData.id);
        }
      }
    } catch (error) {
      console.error('Profile fetching error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWasteCompanies = async (orgId: string) => {
    try {
      const { data, error } = await supabase
        .from('waste_companies')
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.waste_companies" does not exist')) {
          console.warn('public.waste_companies table missing');
          setWasteCompanies([]);
        } else {
          throw error;
        }
      } else {
        setWasteCompanies(data || []);
      }
    } catch (err) {
      console.error('Error fetching waste companies:', err);
    }
  };

  const fetchWasteRecords = async (clientId: string) => {
    setLoadingWaste(true);
    setIsWasteTableMissing(false);
    try {
      const { data, error } = await supabase
        .from('waste_records')
        .select(`
          *,
          client:consultant_clients(id, name),
          creator:profiles!created_by(full_name),
          transporter_company:waste_companies!transporter_id(id, name, address, latitude, longitude),
          destination_company:waste_companies!destination_id(id, name, address, latitude, longitude)
        `)
        .eq('client_id', clientId)
        .order('exit_date', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "public.waste_records" does not exist')) {
          console.warn('public.waste_records table missing');
          setIsWasteTableMissing(true);
          setWasteRecords([]);
        } else {
          throw error;
        }
      } else {
        setWasteRecords(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching waste records:', err);
    } finally {
      setLoadingWaste(false);
    }
  };

  const handleAddWasteRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWasteClientId || !newWasteCode || !newWasteExitDate || !newWasteQuantity || !newWasteTransporterId || !newWasteDestinationId || !newWasteDisposalType || !newWasteDisposalCode) {
      return alert('Lütfen zorunlu tüm alanları doldurun.');
    }

    setSubmittingWaste(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const qty = parseFloat(newWasteQuantity);
      if (isNaN(qty) || qty <= 0) {
        return alert('Atık miktarı 0\'dan büyük olmalıdır.');
      }

      const selectedTransporter = wasteCompanies.find(c => c.id === newWasteTransporterId);
      const selectedDestination = wasteCompanies.find(c => c.id === newWasteDestinationId);

      const { error } = await supabase
        .from('waste_records')
        .insert([{
          client_id: newWasteClientId,
          waste_code: newWasteCode,
          exit_date: newWasteExitDate,
          quantity_kg: qty,
          transporter_id: newWasteTransporterId || null,
          destination_id: newWasteDestinationId || null,
          transporter: selectedTransporter?.name || null,
          transporter_address: selectedTransporter?.address || null,
          destination: selectedDestination?.name || null,
          destination_address: selectedDestination?.address || null,
          disposal_type: newWasteDisposalType,
          disposal_code: newWasteDisposalCode || null,
          description: newWasteDescription.trim() || null,
          created_by: session.user.id
        }]);

      if (error) throw error;

      alert('Atık kaydı başarıyla eklendi!');
      setShowAddWasteModal(false);
      
      // Reset form
      setNewWasteCode('');
      setNewWasteQuantity('');
      setNewWasteTransporterId('');
      setNewWasteDestinationId('');
      setNewWasteDisposalCode('');
      setNewWasteDescription('');

      // Refresh records
      if (selectedClientId === newWasteClientId) {
        await fetchWasteRecords(selectedClientId);
      } else {
        setSelectedClientId(newWasteClientId);
      }
    } catch (err: any) {
      alert('Atık kaydı eklenirken hata: ' + err.message);
    } finally {
      setSubmittingWaste(false);
    }
  };

  const handleUpdateWaste = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editWasteClientId || !editWasteCode || !editWasteExitDate || !editWasteQuantity || !editWasteTransporterId || !editWasteDestinationId || !editWasteDisposalType || !editWasteDisposalCode) {
      return alert('Lütfen zorunlu tüm alanları doldurun.');
    }

    setUpdatingWaste(true);
    try {
      const qty = parseFloat(editWasteQuantity);
      if (isNaN(qty) || qty <= 0) {
        return alert('Atık miktarı 0\'dan büyük olmalıdır.');
      }

      const selectedTransporter = wasteCompanies.find(c => c.id === editWasteTransporterId);
      const selectedDestination = wasteCompanies.find(c => c.id === editWasteDestinationId);

      const { error } = await supabase
        .from('waste_records')
        .update({
          client_id: editWasteClientId,
          waste_code: editWasteCode,
          exit_date: editWasteExitDate,
          quantity_kg: qty,
          transporter_id: editWasteTransporterId || null,
          destination_id: editWasteDestinationId || null,
          transporter: selectedTransporter?.name || null,
          transporter_address: selectedTransporter?.address || null,
          destination: selectedDestination?.name || null,
          destination_address: selectedDestination?.address || null,
          disposal_type: editWasteDisposalType,
          disposal_code: editWasteDisposalCode || null,
          description: editWasteDescription.trim() || null,
        })
        .eq('id', editingWasteId);

      if (error) throw error;

      alert('Atık kaydı başarıyla güncellendi!');
      setShowEditWasteModal(false);
      
      if (selectedClientId === editWasteClientId) {
        await fetchWasteRecords(selectedClientId);
      } else {
        setSelectedClientId(editWasteClientId);
      }
    } catch (err: any) {
      alert('Atık kaydı güncellenirken hata: ' + err.message);
    } finally {
      setUpdatingWaste(false);
    }
  };

  const handleDeleteWaste = async (id: string) => {
    if (!window.confirm('Bu atık kaydını silmek istediğinize emin misiniz?')) return;
    try {
      const { error } = await supabase
        .from('waste_records')
        .delete()
        .eq('id', id);

      if (error) throw error;

      alert('Atık kaydı silindi.');
      await fetchWasteRecords(selectedClientId);
    } catch (err: any) {
      alert('Kayıt silinirken hata: ' + err.message);
    }
  };

  const handleOpenEditWasteModal = (rec: WasteRecord) => {
    setEditingWasteId(rec.id);
    setEditWasteClientId(rec.client_id || '');
    setEditWasteCode(rec.waste_code || '');
    setEditWasteExitDate(rec.exit_date || '');
    setEditWasteQuantity(String(rec.quantity_kg) || '');
    setEditWasteTransporterId(rec.transporter_id || '');
    setEditWasteDestinationId(rec.destination_id || '');
    setEditWasteDisposalType(rec.disposal_type || 'recovery');
    setEditWasteDisposalCode(rec.disposal_code || '');
    setEditWasteDescription(rec.description || '');
    setShowEditWasteModal(true);
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyName.trim()) {
      return alert('Lütfen firma adını yazın.');
    }
    if (!myOrg) return;

    setSubmittingCompany(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { error } = await supabase
        .from('waste_companies')
        .insert([{
          organization_id: myOrg.id,
          name: newCompanyName.trim(),
          type: newCompanyType,
          address: newCompanyAddress.trim() || null,
          latitude: newCompanyLat,
          longitude: newCompanyLng,
          created_by: session?.user.id
        }]);

      if (error) throw error;

      alert('Firma başarıyla kaydedildi.');
      setShowAddCompanyModal(false);
      await fetchWasteCompanies(myOrg.id);
    } catch (err: any) {
      alert('Firma kaydedilirken hata: ' + err.message);
    } finally {
      setSubmittingCompany(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedReportClientId) {
      return alert('Lütfen raporu oluşturulacak firmayı seçin.');
    }
    if (!myOrg) return;

    setGeneratingReport(true);
    try {
      // 1. Fetch Client Details
      const { data: clientDetails, error: clientErr } = await supabase
        .from('consultant_clients')
        .select('*')
        .eq('id', selectedReportClientId)
        .single();

      if (clientErr || !clientDetails) {
        throw new Error(clientErr?.message || 'Firma bilgileri bulunamadı.');
      }

      // 2. Fetch Waste Records
      let query = supabase
        .from('waste_records')
        .select(`
          *,
          transporter_company:waste_companies!transporter_id(id, name, address, latitude, longitude),
          destination_company:waste_companies!destination_id(id, name, address, latitude, longitude)
        `)
        .eq('client_id', selectedReportClientId);

      let periodLabel = 'Tüm Zamanlar (Genel)';
      if (reportPeriodType === 'monthly') {
        const [year, month] = reportMonth.split('-');
        const lastDay = new Date(Number(year), Number(month), 0).getDate();
        const start = `${reportMonth}-01`;
        const end = `${reportMonth}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('exit_date', start).lte('exit_date', end);
        periodLabel = `${month}/${year} (Aylık)`;
      } else if (reportPeriodType === 'yearly') {
        const start = `${reportYear}-01-01`;
        const end = `${reportYear}-12-31`;
        query = query.gte('exit_date', start).lte('exit_date', end);
        periodLabel = `${reportYear} Yılı (Yıllık)`;
      }

      const { data: records, error: recErr } = await query.order('exit_date', { ascending: true });
      if (recErr) throw recErr;

      const reportRecords = records || [];

      if (reportRecords.length === 0) {
        alert('Seçilen dönemde herhangi bir atık çıkışı bulunmamaktadır.');
        setGeneratingReport(false);
        return;
      }

      // Calculations
      let totalQty = 0;
      let hazardousQty = 0;
      let nonHazardousQty = 0;

      const codeQuantities: Record<string, { name: string, isHazardous: boolean, total: number }> = {};
      const destQuantities: Record<string, { address: string, total: number }> = {};

      reportRecords.forEach(rec => {
        const qty = Number(rec.quantity_kg) || 0;
        totalQty += qty;

        const isHaz = rec.waste_code.includes('*');
        if (isHaz) hazardousQty += qty;
        else nonHazardousQty += qty;

        // Group by Code
        const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
        const name = wasteDef ? wasteDef.name : 'Diğer/Özel Atık';
        if (!codeQuantities[rec.waste_code]) {
          codeQuantities[rec.waste_code] = { name, isHazardous: isHaz, total: 0 };
        }
        codeQuantities[rec.waste_code].total += qty;

        // Group by Destination
        const destName = rec.destination_company?.name || rec.destination || 'Belirtilmedi';
        const destAddr = rec.destination_company?.address || rec.destination_address || '-';
        if (!destQuantities[destName]) {
          destQuantities[destName] = { address: destAddr, total: 0 };
        }
        destQuantities[destName].total += qty;
      });

      // HTML generation
      const groupedByCodeHtml = Object.entries(codeQuantities).map(([code, data]) => `
        <tr>
          <td><span class="badge ${data.isHazardous ? 'badge-danger' : 'badge-safe'} font-mono">${code}</span></td>
          <td>${data.name}</td>
          <td class="center font-bold text-xs">${data.isHazardous ? 'Tehlikeli Atık' : 'Tehlikesiz Atık'}</td>
          <td class="right font-bold">${data.total.toLocaleString('tr-TR')} kg</td>
        </tr>
      `).join('');

      const groupedByDestHtml = Object.entries(destQuantities).map(([name, data]) => `
        <tr>
          <td class="font-bold text-xs">${name}</td>
          <td class="text-xs text-gray-500">${data.address}</td>
          <td class="right font-bold">${data.total.toLocaleString('tr-TR')} kg</td>
        </tr>
      `).join('');

      const detailedRowsHtml = reportRecords.map(rec => {
        const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
        const name = wasteDef ? wasteDef.name : 'Diğer/Özel Atık';
        const dateStr = new Date(rec.exit_date).toLocaleDateString('tr-TR');
        const transporterName = rec.transporter_company?.name || rec.transporter || '-';
        const destinationName = rec.destination_company?.name || rec.destination || '-';
        const dispType = rec.disposal_type === 'recovery' ? 'Geri Kazanım' : 'Bertaraf';
        const dispCode = rec.disposal_code ? ` (${rec.disposal_code})` : '';

        return `
          <tr>
            <td class="font-mono text-xs">${dateStr}</td>
            <td>
              <span class="badge ${rec.waste_code.includes('*') ? 'badge-danger' : 'badge-safe'} font-mono mr-1">${rec.waste_code}</span>
              <span class="text-slate-700 font-semibold">${name}</span>
            </td>
            <td class="right font-bold text-slate-800">${rec.quantity_kg.toLocaleString('tr-TR')} kg</td>
            <td class="text-xs">${transporterName}</td>
            <td class="text-xs">${destinationName}</td>
            <td class="center"><span class="badge ${rec.disposal_type === 'recovery' ? 'badge-safe' : 'badge-danger'} text-[10px]">${dispType}${dispCode}</span></td>
          </tr>
        `;
      }).join('');

      const printWindow = window.open('', '_blank');
      if (!printWindow) throw new Error('Yazdırma penceresi engellendi. Lütfen pop-up engelleyicileri kaldırın.');

      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Atık Çıkış Beyan Raporu — ${clientDetails.name}</title>
  <style>
    body { font-family: 'Inter', system-ui, -apple-system, sans-serif; color: #1e293b; padding: 30px; margin: 0; line-height: 1.5; font-size: 13px; background:#fff; }
    .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 25px; }
    .header-logo { font-size: 20px; font-weight: 800; color: #0f172a; }
    .header-logo span { color: #2ca58d; }
    .header-meta { text-align: right; font-size: 11px; color: #64748b; font-weight: 600; }
    .title { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 5px; }
    .subtitle { font-size: 12px; color: #64748b; font-weight: 600; margin-bottom: 25px; }
    
    .grid-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin-bottom: 30px; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px; }
    .card-label { font-size: 10px; text-transform: uppercase; font-weight: 800; color: #64748b; letter-spacing: 0.5px; margin-bottom: 5px; }
    .card-value { font-size: 22px; font-weight: 900; color: #0f172a; }
    .card-unit { font-size: 11px; font-weight: 600; color: #64748b; margin-left: 2px; }
    .card-danger { border-left: 4px solid #ef4444; }
    .card-safe { border-left: 4px solid #10b981; }
    .card-primary { border-left: 4px solid #2ca58d; }

    .section { margin-bottom: 30px; }
    .section-title { font-size: 13px; font-weight: 800; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
    th { background: #f1f5f9; color: #475569; font-weight: 800; font-size: 11px; text-transform: uppercase; padding: 8px 12px; border: 1px solid #cbd5e1; text-align: left; }
    td { padding: 8px 12px; border: 1px solid #e2e8f0; font-size: 12px; }
    tr:nth-child(even) td { background: #f8fafc; }
    .right { text-align: right; }
    .center { text-align: center; }
    .font-mono { font-family: monospace; font-weight: bold; }
    
    .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
    .badge-danger { background: #fee2e2; color: #991b1b; }
    .badge-safe { background: #d1fae5; color: #065f46; }

    .signature-row { display: flex; justify-content: space-between; margin-top: 50px; page-break-inside: avoid; }
    .signature-box { width: 45%; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 20px; text-align: center; }
    .sig-label { font-size: 11px; font-weight: 800; color: #475569; margin-bottom: 40px; line-height: 1.4; }
    .sig-line { width: 80%; border-bottom: 1px solid #94a3b8; margin: 0 auto 5px auto; }
    .sig-date { font-size: 10px; color: #64748b; font-weight: 600; }
    
    .page-break { page-break-before: always; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <div class="header-logo">EVRAK<span>LAB</span></div>
        <div style="font-size:10px; font-weight:bold; color:#64748b; margin-top:2px;">ATIK BEYAN VE ÇIKIŞ TAKİP SİSTEMİ</div>
      </div>
      <div class="header-meta">
        <div>Tarih: ${new Date().toLocaleDateString('tr-TR')}</div>
        <div>Rapor ID: WBR-${Math.floor(100000 + Math.random() * 900000)}</div>
        <div style="color:#2ca58d; font-weight:800; font-size:10px; margin-top:3px;">ENV-COMPLIANT PRINT</div>
      </div>
    </div>

    <h2 class="title">${clientDetails.name}</h2>
    <div class="subtitle">Atık Çıkış Beyan Raporu — ${periodLabel}</div>

    <!-- WIDGET SUMMARY -->
    <div class="grid-summary">
      <div class="card card-primary">
        <div class="card-label">Toplam Atık Çıkışı</div>
        <div class="card-value">${totalQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-danger">
        <div class="card-label">Tehlikeli Atık</div>
        <div class="card-value">${hazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
      <div class="card card-safe">
        <div class="card-label">Tehlikesiz Atık</div>
        <div class="card-value">${nonHazardousQty.toLocaleString('tr-TR')}<span class="card-unit">kg</span></div>
      </div>
    </div>

    <!-- SECTION 1: CODE GROUPS -->
    <div class="section">
      <div class="section-title">1 — Atık Kodlarına Göre Kümülatif Dağılım</div>
      <table>
        <thead>
          <tr>
            <th style="width:110px">Atık Kodu</th>
            <th>Atık Tanımı</th>
            <th class="center" style="width:110px">Sınıfı</th>
            <th class="right" style="width:130px">Toplam Miktar</th>
          </tr>
        </thead>
        <tbody>
          ${groupedByCodeHtml}
        </tbody>
      </table>
    </div>

    <!-- SECTION 2: DESTINATION GROUPS -->
    <div class="section">
      <div class="section-title">2 — Gönderilen Geri Kazanım / Bertaraf Tesisleri</div>
      <table>
        <thead>
          <tr>
            <th>Gönderilen Tesis / Alıcı Firma</th>
            <th>Adres / Lokasyon</th>
            <th class="right" style="width:150px">Toplam Miktar</th>
          </tr>
        </thead>
        <tbody>
          ${groupedByDestHtml}
        </tbody>
      </table>
    </div>

    <!-- SECTION 3: DETAIL ROWS -->
    <div class="section page-break">
      <div class="section-title">3 — Ayrıntılı Atık Çıkış Kayıtları</div>
      <table>
        <thead>
          <tr>
            <th style="width:88px">Tarih</th>
            <th>Atık Kodu &amp; Tanımı</th>
            <th class="right" style="width:100px">Miktar</th>
            <th>Taşıyıcı Firma</th>
            <th>Gönderilen Tesis</th>
            <th class="center" style="width:130px">İşlem Yöntemi</th>
          </tr>
        </thead>
        <tbody>
          ${detailedRowsHtml}
        </tbody>
      </table>
    </div>

    <!-- SIGNATURES -->
    <div class="signature-row">
      <div class="signature-box">
        <div class="sig-label">${clientDetails.name}<br/>Yetkili Temsilci / İmza</div>
        <div class="sig-line"></div>
        <div class="sig-date">Tarih: _____ / _____ / 20_____</div>
      </div>
      <div class="signature-box">
        <div class="sig-label">${myOrg.name}<br/>Çevre Görevlisi / İmza</div>
        <div class="sig-line"></div>
        <div class="sig-date">Tarih: _____ / _____ / 20_____</div>
      </div>
    </div>

  </div>
  <script>
    window.onload = function() { setTimeout(function(){ window.print(); }, 700); };
  </script>
</body>
</html>
      `);
      printWindow.document.close();
      setShowReportModal(false);
    } catch (err: any) {
      alert('Rapor oluşturulurken hata: ' + err.message);
    } finally {
      setGeneratingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 text-sm text-gray-500 gap-2">
        <Loader className="animate-spin text-[#2ca58d]" size={20} /> Yükleniyor...
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* HEADER SECTION */}
      <div className="bg-white p-6 rounded-2xl border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn">
        <div>
          <h2 className="font-extrabold text-gray-800 text-2xl flex items-center gap-2">
            <Trash2 className="text-[#2ca58d]" size={28} />
            Atık Yönetimi Modülü
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            İşletmeleriniz için ortaya çıkan atıkları kaydedin, taşıyıcı ve alıcı/bertaraf tesisi bilgilerini takip edin.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              if (assignedClients.length === 0) {
                return alert('Herhangi bir firma bulunmadığından atık kaydı oluşturamazsınız.');
              }
              setNewWasteClientId(selectedClientId || assignedClients[0]?.id || '');
              setNewWasteCode('');
              setNewWasteExitDate(new Date().toISOString().split('T')[0]);
              setNewWasteQuantity('');
              setNewWasteTransporterId('');
              setNewWasteDestinationId('');
              setNewWasteDisposalCode('');
              setNewWasteDisposalType('recovery');
              setNewWasteDescription('');
              setShowAddWasteModal(true);
            }}
            className="bg-[#2ca58d] hover:bg-[#238c75] text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md"
          >
            <PlusCircle size={16} /> Yeni Atık Kaydı
          </button>
          <button
            onClick={() => {
              setNewCompanyType('transporter');
              setNewCompanyName('');
              setNewCompanyAddress('');
              setNewCompanyLat(null);
              setNewCompanyLng(null);
              setShowAddCompanyModal(true);
            }}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <PlusCircle size={16} className="text-[#2ca58d]" /> Firma Ekle
          </button>
          <button
            onClick={() => {
              setSelectedReportClientId(selectedClientId || assignedClients[0]?.id || '');
              setReportPeriodType('all');
              setReportMonth(new Date().toISOString().substring(0, 7));
              setReportYear(String(new Date().getFullYear()));
              setShowReportModal(true);
            }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition shadow-md shadow-purple-50"
          >
            <FileText size={16} /> Çıkış Raporu (PDF)
          </button>
        </div>
      </div>

      {/* DUAL SECTION LAYOUT */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* CLIENT LIST COLUMN (Shown if there are multiple assigned clients) */}
        {assignedClients.length > 1 && (
          <div className="w-full lg:w-72 shrink-0 bg-white p-5 rounded-2xl border shadow-sm space-y-4 h-fit">
            <div>
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-wider block">İşletmeler</span>
              <p className="text-[11px] text-gray-400 mt-0.5">Atık kaydını yönetmek istediğiniz firmayı seçin.</p>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {assignedClients.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedClientId(c.id)}
                  className={`w-full text-left p-3.5 rounded-xl border transition flex items-center gap-2.5 ${
                    selectedClientId === c.id
                      ? 'border-[#2ca58d] bg-[#2ca58d]/5 text-[#1b6d5c] font-extrabold shadow-sm'
                      : 'border-slate-100 hover:bg-slate-50 bg-white text-slate-700'
                  }`}
                >
                  <Building size={16} className={selectedClientId === c.id ? 'text-[#2ca58d]' : 'text-gray-400'} />
                  <span className="text-xs truncate">{c.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* RECORDS AND CONTENT COLUMN */}
        <div className="flex-1 space-y-6">
          {/* SQL Table Missing Banner */}
          {isWasteTableMissing && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center space-y-3">
              <AlertCircle className="text-red-600 mx-auto animate-bounce" size={40} />
              <h4 className="font-bold text-red-800 text-lg">Veritabanı Tablosu Eksik!</h4>
              <p className="text-sm text-red-700 max-w-xl mx-auto leading-relaxed">
                Atık Yönetimi özelliğini kullanabilmek için öncelikle veritabanı tablolarının oluşturulması gerekmektedir. 
                Lütfen projenizin kök dizinindeki <b>create_waste_records.sql</b> dosyasının içeriğini Supabase SQL Editörünüzde çalıştırın.
              </p>
            </div>
          )}

          {/* Filtering Bar */}
          {!isWasteTableMissing && (
            <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-wrap gap-4 items-center animate-fadeIn justify-between">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2.5">
                  <Search size={16} className="text-gray-400" />
                  <input
                    type="text"
                    placeholder="Kod veya açıklama ara..."
                    value={wasteSearchQuery}
                    onChange={(e) => setWasteSearchQuery(e.target.value)}
                    className="p-2 border rounded-xl text-xs bg-white border-gray-200 outline-none text-slate-700 font-semibold w-52 focus:ring-1 focus:ring-[#2ca58d]"
                  />
                </div>

                <div className="flex gap-1.5 bg-slate-100 p-1 rounded-xl">
                  <button
                    onClick={() => setWasteFilterType('all')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      wasteFilterType === 'all'
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    onClick={() => setWasteFilterType('recovery')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      wasteFilterType === 'recovery'
                        ? 'bg-white text-[#2ca58d] shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Geri Kazanım
                  </button>
                  <button
                    onClick={() => setWasteFilterType('disposal')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      wasteFilterType === 'disposal'
                        ? 'bg-white text-rose-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Bertaraf
                  </button>
                </div>
              </div>

              {selectedClientId && (
                <button
                  onClick={() => fetchWasteRecords(selectedClientId)}
                  className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 font-bold"
                >
                  <RefreshCw size={12} className={loadingWaste ? 'animate-spin' : ''} />
                  Yenile
                </button>
              )}
            </div>
          )}

          {/* List Table */}
          {!isWasteTableMissing && (
            loadingWaste ? (
              <div className="flex justify-center items-center py-20 bg-white rounded-2xl border shadow-sm text-xs text-gray-500 gap-2">
                <Loader className="animate-spin text-[#2ca58d]" size={18} /> Yükleniyor...
              </div>
            ) : (
              (() => {
                const filtered = wasteRecords.filter(rec => {
                  if (wasteFilterType !== 'all' && rec.disposal_type !== wasteFilterType) return false;
                  if (wasteSearchQuery) {
                    const query = wasteSearchQuery.toLowerCase();
                    const codeMatch = rec.waste_code.toLowerCase().includes(query);
                    const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
                    const nameMatch = wasteDef ? wasteDef.name.toLowerCase().includes(query) : false;
                    const descMatch = rec.description ? rec.description.toLowerCase().includes(query) : false;
                    const transporterMatch = rec.transporter_company?.name.toLowerCase().includes(query) || rec.transporter?.toLowerCase().includes(query);
                    const destinationMatch = rec.destination_company?.name.toLowerCase().includes(query) || rec.destination?.toLowerCase().includes(query);
                    return codeMatch || nameMatch || descMatch || transporterMatch || destinationMatch;
                  }
                  return true;
                });

                if (filtered.length === 0) {
                  return (
                    <div className="text-center py-20 bg-white border border-dashed rounded-2xl text-xs text-gray-400 italic space-y-2">
                      <Trash2 size={36} className="mx-auto mb-2 opacity-25 text-[#2ca58d]" />
                      Atık gönderim kaydı bulunamadı.
                    </div>
                  );
                }

                return (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden animate-fadeIn">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-150">
                        <thead className="bg-gray-50">
                          <tr>
                            {assignedClients.length > 1 && (
                              <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Firma</th>
                            )}
                            <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Atık Kodu & Tanımı</th>
                            <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Çıkış Tarihi</th>
                            <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Miktar (kg)</th>
                            <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Taşıyıcı</th>
                            <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Gönderilen Tesis</th>
                            <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Metot</th>
                            <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Açıklama</th>
                            <th className="px-6 py-3.5 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">İşlemler</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {filtered.map(rec => {
                            const wasteDef = WASTE_CODES.find(w => w.code === rec.waste_code);
                            const transporterName = rec.transporter_company?.name || rec.transporter || '-';
                            const destinationName = rec.destination_company?.name || rec.destination || '-';

                            return (
                              <tr key={rec.id} className="hover:bg-slate-50/50 transition">
                                {assignedClients.length > 1 && (
                                  <td className="px-6 py-4 whitespace-nowrap text-xs font-bold text-gray-700">
                                    {rec.client?.name || '-'}
                                  </td>
                                )}
                                <td className="px-6 py-4 text-xs">
                                  <div className="flex items-start gap-2">
                                    <span className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] shrink-0 ${
                                      rec.waste_code.includes('*')
                                        ? 'bg-rose-100 text-rose-800'
                                        : 'bg-green-100 text-green-800'
                                    }`}>
                                      {rec.waste_code}
                                    </span>
                                    <span className="text-slate-600 font-semibold line-clamp-2 max-w-xs">
                                      {wasteDef?.name || 'Diğer / Özel Atık'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 font-medium">
                                  {new Date(rec.exit_date).toLocaleDateString('tr-TR')}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs font-black text-right text-slate-800">
                                  {rec.quantity_kg.toLocaleString('tr-TR')}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-600 font-medium max-w-xs truncate">
                                  {transporterName}
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-600 font-medium max-w-xs truncate">
                                  {destinationName}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-xs">
                                  <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                    rec.disposal_type === 'recovery'
                                      ? 'bg-green-50 text-green-700 border border-green-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  }`}>
                                    {rec.disposal_type === 'recovery' ? 'Geri Kazanım' : 'Bertaraf'}
                                    {rec.disposal_code ? ` (${rec.disposal_code})` : ''}
                                  </span>
                                </td>
                                <td className="px-6 py-4 text-xs text-slate-400 italic max-w-xs truncate">
                                  {rec.description || '-'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-center text-xs font-medium">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => handleOpenEditWasteModal(rec)}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                      title="Düzenle"
                                    >
                                      <Edit2 size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteWaste(rec.id)}
                                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                      title="Sil"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })()
            )
          )}
        </div>
      </div>

      {/* MODALS */}
      {/* 1. ADD WASTE SHIPMENT MODAL */}
      {showAddWasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scaleIn border">
            <div className="bg-gradient-to-r from-[#2ca58d] to-[#1d826e] p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Yeni Atık Gönderimi Ekle</h3>
                <p className="text-xs text-white/80">Yeni bir atık çıkış kaydı beyanı ekleyin.</p>
              </div>
              <button
                onClick={() => setShowAddWasteModal(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddWasteRecord} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Select Client */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Çıkan Firma <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={newWasteClientId}
                  onChange={(e) => setNewWasteClientId(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-bold"
                >
                  <option value="">Seçiniz...</option>
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Waste Code autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Kodu & Tanımı <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Kod yazın (örn: 15 01 02) veya arayın..."
                  value={newWasteCode}
                  onChange={(e) => setNewWasteCode(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-mono font-bold text-slate-850"
                />
                {newWasteCode.trim().length > 0 && !WASTE_CODES.some(w => w.code === newWasteCode) && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 py-1 text-xs">
                    {WASTE_CODES.filter(w => 
                      w.code.includes(newWasteCode) || 
                      w.name.toLowerCase().includes(newWasteCode.toLowerCase())
                    ).slice(0, 15).map(w => (
                      <button
                        type="button"
                        key={w.code}
                        onClick={() => setNewWasteCode(w.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                      >
                        <span className="font-bold font-mono text-[#2ca58d] mr-2">{w.code}</span>
                        <span className="text-gray-600 text-[11px]">{w.name}</span>
                      </button>
                    ))}
                    {WASTE_CODES.filter(w => 
                      w.code.includes(newWasteCode) || 
                      w.name.toLowerCase().includes(newWasteCode.toLowerCase())
                    ).length === 0 && (
                      <div className="px-3 py-2 text-gray-400 italic text-[11px]">
                        Özel kod olarak kaydedilecek: "{newWasteCode}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Date and Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Çıkış Tarihi <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={newWasteExitDate}
                    onChange={(e) => setNewWasteExitDate(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Miktar (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="Miktar"
                    value={newWasteQuantity}
                    onChange={(e) => setNewWasteQuantity(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-bold"
                  />
                </div>
              </div>

              {/* Transporter and Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Taşıyıcı Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newWasteTransporterId}
                    onChange={(e) => setNewWasteTransporterId(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Gönderilen Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={newWasteDestinationId}
                    onChange={(e) => setNewWasteDestinationId(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Recovery / Disposal code selection */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Yöntem Türü <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="new_disposal_type"
                      value="recovery"
                      checked={newWasteDisposalType === 'recovery'}
                      onChange={() => {
                        setNewWasteDisposalType('recovery');
                        setNewWasteDisposalCode('');
                      }}
                      className="text-[#2ca58d] focus:ring-[#2ca58d]"
                    />
                    Geri Kazanım
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="new_disposal_type"
                      value="disposal"
                      checked={newWasteDisposalType === 'disposal'}
                      onChange={() => {
                        setNewWasteDisposalType('disposal');
                        setNewWasteDisposalCode('');
                      }}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Bertaraf
                  </label>
                </div>

                {newWasteDisposalType === 'recovery' ? (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Geri Kazanım Kodu (R Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={newWasteDisposalCode}
                      onChange={(e) => setNewWasteDisposalCode(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d]"
                    >
                      <option value="">Kod Seçiniz (R1 - R13)...</option>
                      {RECOVERY_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Bertaraf Kodu (D Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={newWasteDisposalCode}
                      onChange={(e) => setNewWasteDisposalCode(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d]"
                    >
                      <option value="">Kod Seçiniz (D1 - D15)...</option>
                      {DISPOSAL_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <textarea
                  placeholder="Atıkla alakalı notlar..."
                  value={newWasteDescription}
                  onChange={(e) => setNewWasteDescription(e.target.value)}
                  rows={2}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-[#2ca58d] resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddWasteModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submittingWaste}
                  className="px-5 py-2 bg-[#2ca58d] hover:bg-[#238c75] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {submittingWaste && <Loader className="animate-spin" size={14} />}
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. EDIT WASTE SHIPMENT MODAL */}
      {showEditWasteModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden animate-scaleIn border">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Atık Gönderim Kaydını Düzenle</h3>
                <p className="text-xs text-white/80">Kayıtlı atık çıkış bilgilerini güncelleyin.</p>
              </div>
              <button
                onClick={() => setShowEditWasteModal(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateWaste} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* Select Client */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Çıkan Firma <span className="text-red-500">*</span>
                </label>
                <select
                  required
                  value={editWasteClientId}
                  onChange={(e) => setEditWasteClientId(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-bold"
                >
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {/* Waste Code autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Atık Kodu & Tanımı <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  value={editWasteCode}
                  onChange={(e) => setEditWasteCode(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-mono font-bold text-slate-850"
                />
                {editWasteCode.trim().length > 0 && !WASTE_CODES.some(w => w.code === editWasteCode) && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded-xl shadow-lg max-h-48 overflow-y-auto z-50 py-1 text-xs">
                    {WASTE_CODES.filter(w => 
                      w.code.includes(editWasteCode) || 
                      w.name.toLowerCase().includes(editWasteCode.toLowerCase())
                    ).slice(0, 15).map(w => (
                      <button
                        type="button"
                        key={w.code}
                        onClick={() => setEditWasteCode(w.code)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-0"
                      >
                        <span className="font-bold font-mono text-blue-600 mr-2">{w.code}</span>
                        <span className="text-gray-600 text-[11px]">{w.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Date and Amount */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Çıkış Tarihi <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="date"
                    value={editWasteExitDate}
                    onChange={(e) => setEditWasteExitDate(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Miktar (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={editWasteQuantity}
                    onChange={(e) => setEditWasteQuantity(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-bold"
                  />
                </div>
              </div>

              {/* Transporter and Destination */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Taşıyıcı Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editWasteTransporterId}
                    onChange={(e) => setEditWasteTransporterId(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">
                    Gönderilen Firma <span className="text-red-500">*</span>
                  </label>
                  <select
                    required
                    value={editWasteDestinationId}
                    onChange={(e) => setEditWasteDestinationId(e.target.value)}
                    className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 font-bold"
                  >
                    <option value="">Seçiniz...</option>
                    {wasteCompanies.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Method code */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Yöntem Türü <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4 mb-2">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="edit_disposal_type"
                      value="recovery"
                      checked={editWasteDisposalType === 'recovery'}
                      onChange={() => {
                        setEditWasteDisposalType('recovery');
                        setEditWasteDisposalCode('');
                      }}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Geri Kazanım
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="edit_disposal_type"
                      value="disposal"
                      checked={editWasteDisposalType === 'disposal'}
                      onChange={() => {
                        setEditWasteDisposalType('disposal');
                        setEditWasteDisposalCode('');
                      }}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    Bertaraf
                  </label>
                </div>

                {editWasteDisposalType === 'recovery' ? (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Geri Kazanım Kodu (R Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={editWasteDisposalCode}
                      onChange={(e) => setEditWasteDisposalCode(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Kod Seçiniz (R1 - R13)...</option>
                      {RECOVERY_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">
                      Bertaraf Kodu (D Kodu) <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={editWasteDisposalCode}
                      onChange={(e) => setEditWasteDisposalCode(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600"
                    >
                      <option value="">Kod Seçiniz (D1 - D15)...</option>
                      {DISPOSAL_CODES.map(item => (
                        <option key={item.code} value={item.code}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Açıklama (İsteğe Bağlı)
                </label>
                <textarea
                  value={editWasteDescription}
                  onChange={(e) => setEditWasteDescription(e.target.value)}
                  rows={2}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditWasteModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={updatingWaste}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {updatingWaste && <Loader className="animate-spin" size={14} />}
                  Güncelle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. REGISTER WASTE COMPANY (TRANSPORTER/DESTINATION) */}
      {showAddCompanyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden animate-scaleIn border">
            <div className="bg-gradient-to-r from-slate-700 to-slate-800 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Taşıyıcı / Alıcı Firma Ekle</h3>
                <p className="text-xs text-white/80">Sisteme yeni bir taşıma veya bertaraf tesisi kaydedin.</p>
              </div>
              <button
                onClick={() => setShowAddCompanyModal(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Firma Rolü / Türü <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="company_type"
                      value="transporter"
                      checked={newCompanyType === 'transporter'}
                      onChange={() => setNewCompanyType('transporter')}
                      className="text-slate-700 focus:ring-slate-500"
                    />
                    Taşıyıcı Firma
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-700 font-bold cursor-pointer">
                    <input
                      type="radio"
                      name="company_type"
                      value="destination"
                      checked={newCompanyType === 'destination'}
                      onChange={() => setNewCompanyType('destination')}
                      className="text-slate-700 focus:ring-slate-500"
                    />
                    Alıcı / Bertaraf Tesisi
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Firma Adı <span className="text-red-500">*</span>
                </label>
                <input
                  required
                  type="text"
                  placeholder="Firma ünvanını tam olarak girin..."
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-slate-700 font-bold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Açık Adres
                </label>
                <textarea
                  placeholder="Firma yasal adresi..."
                  value={newCompanyAddress}
                  onChange={(e) => setNewCompanyAddress(e.target.value)}
                  rows={2}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-slate-700 resize-none font-semibold text-slate-650"
                />
              </div>

              {/* Coordinates / Map Support */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Harita Konumu (İsteğe Bağlı)
                </label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-slate-50 border p-2.5 rounded-xl text-[10px] font-mono text-gray-500 flex items-center justify-between">
                    <span>
                      {newCompanyLat && newCompanyLng 
                        ? `${newCompanyLat.toFixed(6)}, ${newCompanyLng.toFixed(6)}`
                        : 'Konum seçilmedi'}
                    </span>
                    {newCompanyLat && (
                      <button 
                        type="button" 
                        onClick={() => { setNewCompanyLat(null); setNewCompanyLng(null); }}
                        className="text-red-500 hover:text-red-700"
                      >
                        Temizle
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCompanyMap(true)}
                    className="px-3.5 py-2.5 border rounded-xl text-xs font-bold text-gray-700 hover:bg-gray-50 flex items-center gap-1 shrink-0"
                  >
                    <MapPin size={14} className="text-red-500" />
                    Harita
                  </button>
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddCompanyModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={submittingCompany}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md"
                >
                  {submittingCompany && <Loader className="animate-spin" size={14} />}
                  Firma Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. ATIK ÇIKIŞ RAPORU MODAL */}
      {showReportModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden animate-scaleIn border">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-700 p-6 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Beyan Çıktısı Al (PDF)</h3>
                <p className="text-xs text-white/80">Atık raporu yazdırma parametrelerini seçin.</p>
              </div>
              <button
                onClick={() => setShowReportModal(false)}
                className="text-white hover:bg-white/10 p-1.5 rounded-full transition"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1">
                  Firma / İşletme Seçimi <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedReportClientId}
                  onChange={(e) => setSelectedReportClientId(e.target.value)}
                  className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-600 font-bold"
                >
                  {assignedClients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 mb-2">
                  Dönem Aralığı
                </label>
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-3">
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('all')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriodType === 'all'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tümü
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('monthly')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriodType === 'monthly'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Aylık
                  </button>
                  <button
                    type="button"
                    onClick={() => setReportPeriodType('yearly')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportPeriodType === 'yearly'
                        ? 'bg-white text-purple-700 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Yıllık
                  </button>
                </div>

                {reportPeriodType === 'monthly' && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Ay Seçin</label>
                    <input
                      type="month"
                      value={reportMonth}
                      onChange={(e) => setReportMonth(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-650"
                    />
                  </div>
                )}

                {reportPeriodType === 'yearly' && (
                  <div className="animate-fadeIn">
                    <label className="block text-xs font-bold text-gray-500 mb-1">Yıl Seçin</label>
                    <select
                      value={reportYear}
                      onChange={(e) => setReportYear(e.target.value)}
                      className="w-full border p-2.5 rounded-xl text-xs bg-white outline-none focus:ring-1 focus:ring-purple-650 font-bold"
                    >
                      {Array.from({ length: 10 }, (_, i) => String(new Date().getFullYear() - i)).map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 border rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50"
                >
                  İptal
                </button>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={generatingReport}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-purple-50"
                >
                  {generatingReport && <Loader className="animate-spin" size={14} />}
                  {generatingReport ? 'Oluşturuluyor...' : 'Raporu Oluştur (PDF)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAP PICKER MODAL */}
      <MapPickerModal
        isOpen={showCompanyMap}
        initialLat={newCompanyLat || 39.9334}
        initialLng={newCompanyLng || 32.8597}
        onClose={() => setShowCompanyMap(false)}
        onSelect={(lat, lng, address) => {
          setNewCompanyLat(lat);
          setNewCompanyLng(lng);
          if (address) {
            setNewCompanyAddress(address);
          }
          setShowCompanyMap(false);
        }}
      />
    </div>
  );
}
