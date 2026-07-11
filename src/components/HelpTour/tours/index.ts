import { FileText, ClipboardList, UploadCloud, Share2, PenLine, Shield } from 'lucide-react';
import type { TourId, TourMeta } from '../types';

export const HELP_TOURS: Record<TourId, TourMeta> = {
  documents: {
    title: 'Evraklar Sayfası',
    description: 'Belge listesi, filtreler, durum rozetleri ve satır işlemlerinin ne işe yaradığı.',
    icon: FileText,
    load: () => import('./documentsTour'),
  },
  envReport: {
    title: 'Yeni Rapor Oluştur',
    description: 'Aylık/yıllık rapor sihirbazını adım adım doldurma.',
    icon: ClipboardList,
    load: () => import('./envReportTour'),
  },
  addDocument: {
    title: 'Yeni Belge Yükle',
    description: 'Belge türü, lokasyon, tarih ve dosya yükleme alanlarının kullanımı.',
    icon: UploadCloud,
    load: () => import('./addDocumentTour'),
  },
  forwardDoc: {
    title: 'Personele Sor / Belgeyi İlet',
    description: 'Bir belgeyi ekibe ya da tek bir personele nasıl iletirsiniz.',
    icon: Share2,
    load: () => import('./forwardDocTour'),
  },
  wetSignature: {
    title: 'Islak İmzalı Yükleme',
    description: 'Fiziksel imzalı bir raporu taratıp sisteme yükleme akışı.',
    icon: PenLine,
    load: () => import('./wetSignatureTour'),
  },
  consultantPanel: {
    title: 'Yönetici / Şef / Danışman Paneli',
    description: 'Modül modül panel tanıtımı ve rol farklarının özeti.',
    icon: Shield,
    load: () => import('./consultantPanelTour'),
  },
};

export const ROLE_TOUR_IDS: Record<'normal' | 'staff' | 'manager', TourId[]> = {
  normal: ['documents', 'addDocument', 'envReport', 'wetSignature'],
  staff: ['documents', 'envReport', 'addDocument', 'wetSignature', 'consultantPanel'],
  manager: ['documents', 'envReport', 'addDocument', 'forwardDoc', 'wetSignature', 'consultantPanel'],
};
