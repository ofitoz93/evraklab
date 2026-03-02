const ACCOUNT_ID = '7a88dcc4e4b277ad4577316f3c65a764';
const API_TOKEN = '9Ye-gt9NEL6JmcRJJSKPobz55J4Yl3Hx2rkn86O8';
// vite.config.ts üzerinde tanımladığımız proxy sayesinde CORS sorununu aşmak için '/cf-api' kullanıyoruz
const CLOUDFLARE_BASE_URL = `/cf-api/client/v4/accounts/${ACCOUNT_ID}/ai/v1/chat/completions`;

async function callCloudflareAI(model: string, messages: any[], temperature = 0.2, max_tokens = 1024) {
    try {
        const response = await fetch(CLOUDFLARE_BASE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cevap Kodu: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || "";
    } catch (error: any) {
        throw new Error(`Cloudflare Bağlantı Hatası: ${error.message}`);
    }
}

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

function calculateApplicationDeadline(expiryDateStr: string | null, docType: string): { deadline: string | null, periodMonths: number | null, suggestedValidity: number | null } {
    if (!expiryDateStr) return { deadline: null, periodMonths: null, suggestedValidity: null };

    const expiryDate = new Date(expiryDateStr);
    if (isNaN(expiryDate.getTime())) return { deadline: null, periodMonths: null, suggestedValidity: null };

    let periodMonths = null;
    let suggestedValidity = null;

    // Bilgi bankasında eşleşme ara
    const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
        docType.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(docType.toLowerCase())
    );

    if (key) {
        if (key === 'Çevre İzni') {
            periodMonths = 6;
            suggestedValidity = 5;
        } else if (key === 'Kapasite Raporu') {
            periodMonths = 2;
            suggestedValidity = 2;
        } else if (key === 'İSG Eğitimi') {
            periodMonths = 1;
            suggestedValidity = 1; // Ortalama
        }
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

async function fileToBase64Url(file: File): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            // result string şeklinde data:image/png;base64,... döner
            resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// PDF dosyalarını düz metin olarak okumak için yardımcı fonksiyon (eğer PDF-Lib ile metin çıkarımı yapılsaydı)
// Şu an Groq Vision (Llama 3.2 Vision) sadece resim formatlarını (png, jpeg, webp, heic, heif) destekler
// Bu örnek resim yüklemeleri için tam çalışacak.
export async function analyzeDocumentWithAI(file: File): Promise<AIAnalysisResult> {
    try {
        const prompt = `
      Sen bir profesyonel evrak analiz asistanısın. SADECE BELGEDEKİ METNİ OKU VE İSTENEN BİLGİLERİ OBJEKTİF OLARAK ÇIKAR.
      Hesaplama VEYA mantık yürütme YAPMA. Görevin sadece belgede ne yazıyorsa onu bulmak.
      
      Lütfen şu 3 bilgiyi bul:
      1. Evrak Türü (Örn: Çevre İzni belgesi, Kapasite Raporu, İSG Sertifikası, vb.)
      2. Alınma Tarihi (Düzenleme Tarihi)
      3. Bitiş Tarihi (Geçerlilik Sonu - SADECE BELGEDE YAZIYORSA)
      
      KURALLAR:
      - Tarihleri kesinlikle YYYY-MM-DD formatına çevir.
      - Belgede bitiş tarihi açıkça yazmıyorsa 'expiryDate' alanını null bırak.
      
      ÇIKTIYI SADECE AŞAĞIDAKİ JSON FORMATINDA VER (Bunun dışına çıkma):
      {
        "docType": "Bulunan Belge Türü",
        "acquisitionDate": "YYYY-MM-DD",
        "expiryDate": "YYYY-MM-DD" veya null,
        "isIndefinite": true/false (Süresiz yazıyorsa true),
        "reasoning": "Evrak türünü ve tarihleri belgenin neresinden bulduğunu kısaca açıkla",
        "confidence": "high/medium/low"
      }
    `;

        let contentObj: any = prompt;

        // Sadece desteklenen resim formatlarını vision modele yolla (jpeg, png, webp vb)
        const isImage = file.type.startsWith('image/');

        if (isImage) {
            const base64Url = await fileToBase64Url(file);
            contentObj = [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: base64Url } }
            ];
        } else {
            // Placeholder for PDF. Cloudflare Llama-3.1-8B modeli array kabul etmez (sadece string)
            contentObj = `${prompt}\n\nEk Bilgi: Bu bir '${file.type}' dosyası, adı: '${file.name}'. Görüntü analizi şu an sadece resimler için aktif, belgenin isminden yola çıkarak mantıklı bir tahminde bulun.`;
        }

        const selectedModel = isImage ? "@cf/meta/llama-3.2-11b-vision-instruct" : "@cf/meta/llama-3.1-8b-instruct";
        const text = await callCloudflareAI(selectedModel, [{ role: "user", content: contentObj }], 0.2, 1024);

        // JSON temizleme 
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI geçerli bir JSON yanıtı oluşturamadı.');

        const rawResult = JSON.parse(jsonMatch[0]);

        // 2. AŞAMA: Kodsal Kesin Hesaplama
        // Eğer AI bitiş tarihi bulamadıysa ama bizim veritabanımızda geçerlilik yılı varsa, bitiş tarihini kendimiz ekleyelim (acquisitionDate + validityYears)
        let finalExpiryDate = rawResult.expiryDate;
        let suggestedValidity = null;

        const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
            rawResult.docType.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(rawResult.docType.toLowerCase())
        );

        if (key && !finalExpiryDate && rawResult.acquisitionDate) {
            if (key === 'Çevre İzni') suggestedValidity = 5;
            if (key === 'Kapasite Raporu') suggestedValidity = 2;
            if (key === 'İSG Eğitimi') suggestedValidity = 1;

            if (suggestedValidity) {
                const acqDate = new Date(rawResult.acquisitionDate);
                acqDate.setFullYear(acqDate.getFullYear() + suggestedValidity);
                finalExpiryDate = acqDate.toISOString().split('T')[0];
            }
        }

        const calculated = calculateApplicationDeadline(finalExpiryDate, rawResult.docType);

        return {
            docType: rawResult.docType,
            acquisitionDate: rawResult.acquisitionDate,
            expiryDate: finalExpiryDate,
            applicationDeadline: calculated.deadline,
            isIndefinite: rawResult.isIndefinite || false,
            suggestedValidityYears: calculated.suggestedValidity || suggestedValidity,
            renewalPeriodMonths: calculated.periodMonths,
            reasoning: rawResult.reasoning,
            confidence: rawResult.confidence
        } as AIAnalysisResult;
    } catch (error) {
        console.error('AI Analiz Hatası:', error);
        throw error;
    }
}

export async function getDocTypeInfo(docType: string): Promise<any> {
    const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
        docType.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(docType.toLowerCase())
    );

    if (key) return DOCUMENT_KNOWLEDGE_BASE[key];

    try {
        const prompt = `"${docType}" isimli evrak türü hakkında Türkiye'deki yasal mevzuata göre kısa bir özet (tanım, geçerlilik süresi ve yenileme zamanı) ver. 
    Lütfen şu formatta sadece JSON dön: 
    { "description": "...", "validity": "...", "renewal": "...", "importance": "..." }`;

        const responseText = await callCloudflareAI("@cf/meta/llama-3.1-8b-instruct", [{ role: "user", content: prompt }], 0.1, 512);

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
    } catch {
        return null;
    }
}
