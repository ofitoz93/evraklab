import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

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

async function fileToGenerativePart(file: File) {
    const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.readAsDataURL(file);
    });

    return {
        inlineData: {
            data: base64Data,
            mimeType: file.type,
        },
    };
}

export async function analyzeDocumentWithAI(file: File): Promise<AIAnalysisResult> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

        const prompt = `
      Sen bir profesyonel evrak analiz asistanısın. Görevin, yüklenen evraktan kritik bilgileri ayıklamaktır.
      Lütfen şu bilgileri bul:
      1. Evrak Türü (örn: Çevre İzni, Kapasite Raporu, İSG Eğitimi, vb.)
      2. Alınma Tarihi (Düzenleme Tarihi)
      3. Bitiş Tarihi (Geçerlilik Sonu)
      4. Son Başvuru Tarihi (Yenileme için son tarih)
      
      SON BAŞVURU TARİHİ HESAPLAMA KURALLARI:
      - Evrak türüne göre Türkiye'deki yasal yenileme sürelerini dikkate al.
      - ÖRNEK: Çevre İzni bitişinden EN AZ 180 gün (6 ay) önce başvuru yapılmalıdır.
      - ÖRNEK: Kapasite Raporu bitişinden 2 ay önce başvuru yapılmalıdır.
      - Eğer evrakta yazmıyorsa, evrak türüne göre bu süreyi AI olarak sen belirle ve bitiş tarihinden geri gelerek hesapla.
      
      EĞER EVRAKTA BİTİŞ TARİHİ YAZMIYORSA:
      - Evrak türüne göre standart geçerlilik süresini (ömrünü) kullan.
      - Çevre İzni (5 yıl), Kapasite Raporu (2 yıl), vb.
      
      ÇIKTIYI SADECE AŞAĞIDAKİ JSON FORMATINDA VER:
      {
        "docType": "Evrak Türü",
        "acquisitionDate": "YYYY-MM-DD",
        "expiryDate": "YYYY-MM-DD" veya null,
        "applicationDeadline": "YYYY-MM-DD" veya null (yenileme başvurusu için son gün),
        "isIndefinite": true/false,
        "suggestedValidityYears": sayı (evrak ömrü),
        "renewalPeriodMonths": sayı (bitişten kaç ay önce başvurulmalı),
        "reasoning": "Tarihlerin nasıl hesaplandığına dair kısa açıklama",
        "confidence": "high/medium/low"
      }
    `;

        const filePart = await fileToGenerativePart(file);
        const result = await model.generateContent([prompt, filePart]);
        const response = await result.response;
        const text = response.text();

        // JSON temizleme (bazı durumlarda AI ```json ... ``` bloğu içinde verebilir)
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI geçerli bir JSON yanıtı oluşturamadı.');

        return JSON.parse(jsonMatch[0]) as AIAnalysisResult;
    } catch (error) {
        console.error('AI Analiz Hatası:', error);
        throw error;
    }
}

export async function getDocTypeInfo(docType: string): Promise<any> {
    // Önce Bilgi Bankası'nda ara (Küçük-büyük harf duyarsız)
    const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
        docType.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(docType.toLowerCase())
    );

    if (key) return DOCUMENT_KNOWLEDGE_BASE[key];

    // Eğer bulunamazsa Gemini'ye sor (Kısa ve öz bilgi)
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });
        const prompt = `"${docType}" isimli evrak türü hakkında Türkiye'deki yasal mevzuata göre kısa bir özet (tanım, geçerlilik süresi ve yenileme zamanı) ver. 
    Lütfen şu formatta sadece JSON dön: 
    { "description": "...", "validity": "...", "renewal": "...", "importance": "..." }`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const jsonMatch = response.text().match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
        return null;
    }
}
