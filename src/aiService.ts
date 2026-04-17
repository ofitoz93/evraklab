import { extractTextFromPdf, analyzeTextLocally } from './localScanner';
import type { LocalAnalysisResult } from './localScanner';

const DOCUMENT_KNOWLEDGE_BASE: Record<string, any> = {
    'Çevre İzni': {
        description: 'İşletmelerin faaliyetlerinin çevreye olan etkilerini düzenleyen resmi izin belgesidir.',
        validity: 'Genelde 5 yıl geçerlidir.',
        renewal: 'Belge bitiş tarihinden en az 180 gün (6 ay) önce yenileme başvurusu yapılmalıdır.',
        importance: 'Eksikliği durumunda ağır para cezaları ve işletme durdurma kararı uygulanabilir.'
    },
    'Kapasite Raporu': {
        description: 'Bir firmanın üretim kapasitesini resmi olarak belgeleyen rapordur.',
        validity: 'Genelde 2 yıl geçerlidir.',
        renewal: 'Belge bitiş tarihinden 2 ay önce yenileme işlemleri başlatılmalıdır.',
        importance: 'Teşvikler, ihaleler ve kapasite tayini için kritiktir.'
    },
    'İSG Eğitimi': {
        description: 'Çalışanların iş sağlığı ve güvenliği konusunda almaları yasal zorunluluk olan eğitimdir.',
        validity: 'Tehlike sınıfına göre 1, 2 veya 3 yıl geçerlidir.',
        renewal: 'Süre dolmadan hemen önce eğitim yenilenmelidir.',
        importance: 'İş kazalarında yasal sorumluluk açısından hayati önem taşır.'
    },
    'MSDS (Güvenlik Bilgi Formu)': {
        description: 'Kimyasal maddelerin özelliklerini ve tehlikelerini belirten belgedir.',
        validity: 'Genelde 3 yıl geçerlidir.',
        renewal: 'Yayın tarihinden itibaren 3 yıl içinde yenilenmelidir.',
        importance: 'Kimyasal güvenliği ve yasal uyum için zorunludur.'
    }
};

export interface AIAnalysisResult {
    docType: string;
    acquisitionDate: string | null;
    expiryDate: string | null;
    applicationDeadline: string | null;
    isIndefinite: boolean;
    suggestedValidityYears: number | null;
    renewalPeriodMonths: number | null;
    reasoning: string;
    confidence: 'high' | 'medium' | 'low';
}

function calculateApplicationDeadline(expiryDateStr: string | null, docType: string): { deadline: string | null, periodMonths: number | null, suggestedValidity: number | null } {
    if (!expiryDateStr) return { deadline: null, periodMonths: null, suggestedValidity: null };

    const expiryDate = new Date(expiryDateStr);
    if (isNaN(expiryDate.getTime())) return { deadline: null, periodMonths: null, suggestedValidity: null };

    let periodMonths = null;
    let suggestedValidity = null;

    const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
        docType.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(docType.toLowerCase())
    );

    if (key) {
        if (key === 'Çevre İzni') { periodMonths = 6; suggestedValidity = 5; }
        else if (key === 'Kapasite Raporu') { periodMonths = 2; suggestedValidity = 2; }
        else if (key === 'İSG Eğitimi') { periodMonths = 1; suggestedValidity = 1; }
        else if (key.includes('MSDS')) { periodMonths = 3; suggestedValidity = 3; }
    }

    if (periodMonths) {
        const deadlineDate = new Date(expiryDate);
        deadlineDate.setMonth(deadlineDate.getMonth() - periodMonths);
        return {
            deadline: deadlineDate.toISOString().split('T')[0],
            periodMonths,
            suggestedValidity
        };
    }

    return { deadline: null, periodMonths: null, suggestedValidity: null };
}

export async function analyzeDocumentLocally(file: File): Promise<AIAnalysisResult> {
    try {
        const text = await extractTextFromPdf(file);
        const localResult = analyzeTextLocally(text, file.name);

        const calculated = calculateApplicationDeadline(localResult.expiryDate, localResult.docType);

        return {
            docType: localResult.docType,
            acquisitionDate: localResult.acquisitionDate,
            expiryDate: localResult.expiryDate,
            applicationDeadline: calculated.deadline,
            isIndefinite: localResult.isIndefinite,
            suggestedValidityYears: calculated.suggestedValidity,
            renewalPeriodMonths: calculated.periodMonths,
            reasoning: localResult.reasoning,
            confidence: localResult.confidence
        };
    } catch (error) {
        console.error('Yerel Analiz Hatası:', error);
        throw error;
    }
}

export async function getDocTypeInfo(docType: string): Promise<any> {
    const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
        docType.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(docType.toLowerCase())
    );
    if (key) return DOCUMENT_KNOWLEDGE_BASE[key];
    return null;
}
