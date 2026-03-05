const GEMINI_API_KEY = 'AIzaSyCWNqV60aZjQIuCVKuh-k_OR62lMSHXEFo';

async function callGemini(model: string, contents: any[], temperature = 0.2, maxOutputTokens = 1024) {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents,
                generationConfig: {
                    temperature,
                    maxOutputTokens,
                    responseMimeType: "application/json"
                }
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Cevap Kodu: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    } catch (error: any) {
        throw new Error(`Gemini Bağlantı Hatası: ${error.message}`);
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



async function fileToBase64(file: File): Promise<{ mimeType: string, data: string }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve({ mimeType: file.type, data: base64Data });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// PDF dosyalarını düz metin olarak okumak için yardımcı fonksiyon (eğer PDF-Lib ile metin çıkarımı yapılsaydı)
// Şu an görüntü olarak atıyoruz
export async function analyzeDocumentWithAI(file: File): Promise<AIAnalysisResult> {
    try {
        const prompt = `
      Sen Türkiye mevzuatlarına hakim profesyonel bir evrak analiz asistanısın. Belgedeki metni oku ve istenilen bilgileri çıkar.
      Eğer belgede bitiş tarihi açıkça yazmıyorsa, evrak türünün (örneğin "Çevre İzni", "Kapasite Raporu", "İtfaiye Raporu" vb.) Türkiye Cumhuriyeti yasalarındaki genel geçerlilik süresini (yıl olarak) ve bu belgenin bitmeden ne kadar süre önce (ay olarak) yenilenmesi için başvurulması gerektiğini kendi bilgi birikiminden bularak ekle.
      
      Çıkarman gereken bilgiler:
      1. Evrak Türü (Örn: Çevre İzni belgesi, Kapasite Raporu, İSG Sertifikası vb.)
      2. Alınma Tarihi (Düzenleme Tarihi)
      3. Bitiş Tarihi (Geçerlilik Sonu - Belgede yazıyorsa ekle, yazmıyorsa null dön)
      4. Önerilen Geçerlilik Yılı (Örn: Çevre İzni genelde 5 yıldır. Sayısal olarak dön, bilmiyorsan null)
      5. Yenileme Başvuru Süresi Ay (Örn: Çevre izni için belge bitimine 6 ay kala başvurulur. Sayısal olarak dön, bilmiyorsan null)
      
      KURALLAR:
      - Tarihleri kesinlikle YYYY-MM-DD formatına çevir.
      - Belgede açıkça bitiş tarihi yoksa 'expiryDate' alanını 'null' bırak, fakat 'suggestedValidityYears' ve 'renewalPeriodMonths' alanlarını evrak türüne göre kendi uzmanlığınla mantıklı bir sayı ile doldur. (Örn: Çevre izni için suggestedValidityYears: 5, renewalPeriodMonths: 6)
      
      ÇIKTIYI SADECE AŞAĞIDAKİ JSON FORMATINDA VER (Bunun dışına çıkma):
      {
        "docType": "Bulunan Belge Türü",
        "acquisitionDate": "YYYY-MM-DD" veya null,
        "expiryDate": "YYYY-MM-DD" veya null,
        "isIndefinite": true/false (Süresiz yazıyorsa true),
        "suggestedValidityYears": 5, // (Örnek)
        "renewalPeriodMonths": 6, // (Örnek)
        "reasoning": "Tarihleri ve evrak türünü nereden buldun? Süreleri nasıl hesapladın? Kısaca açıkla.",
        "confidence": "high/medium/low"
      }
    `;

        let contentParts: any[] = [{ text: prompt }];

        // Gemini 2.5 Flash destekleyen formatlar: jpeg, png, webp, heic, pdf vb.
        const isSupported = file.type.startsWith('image/') || file.type === 'application/pdf';

        if (isSupported) {
            const fileData = await fileToBase64(file);
            contentParts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data
                }
            });
        } else {
            // Desteklenmeyen dosyalar için
            contentParts = [{ text: `${prompt}\n\nEk Bilgi: Bu bir '${file.type}' dosyası, adı: '${file.name}'. Görüntü analizi şu an sadece resimler ve PDF dosyaları için aktif, belgenin isminden yola çıkarak mantıklı bir tahminde bulun. Eğer okumak gerekiyorsa sonucu düşük doğrulukla (confidence: low) dönebilirsin.` }];
        }

        const selectedModel = "gemini-2.0-flash";
        const text = await callGemini(selectedModel, [{ role: "user", parts: contentParts }], 0.2, 1024);

        // JSON temizleme
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('AI geçerli bir JSON yanıtı oluşturamadı.');

        const rawResult = JSON.parse(jsonMatch[0]);

        // 2. AŞAMA: Kodsal Kesin Hesaplama ve Fallback
        let finalExpiryDate = rawResult.expiryDate === "null" || !rawResult.expiryDate ? null : rawResult.expiryDate;
        let finalAcquisitionDate = rawResult.acquisitionDate === "null" || !rawResult.acquisitionDate ? null : rawResult.acquisitionDate;

        // AI'ın bulduğu geçerlilik yılı bilgisi
        let suggestedValidity = rawResult.suggestedValidityYears || null;
        let renewalMonths = rawResult.renewalPeriodMonths || null;

        const docTypeStr = String(rawResult.docType || "");

        // Kendi listemiz AI'dan daha öncelikli olsun (Eğer kendi listemizde tanımlıysa)
        const key = Object.keys(DOCUMENT_KNOWLEDGE_BASE).find(k =>
            docTypeStr.toLowerCase().includes(k.toLowerCase()) ||
            k.toLowerCase().includes(docTypeStr.toLowerCase())
        );

        if (key) {
            if (key === 'Çevre İzni') { suggestedValidity = 5; renewalMonths = 6; }
            if (key === 'Kapasite Raporu') { suggestedValidity = 2; renewalMonths = 2; }
            if (key === 'İSG Eğitimi') { suggestedValidity = 1; renewalMonths = 1; }
        }

        // Bitiş tarihi eksikse, alınma tarihi + suggestedValidity üzerinden hesapla
        if (!finalExpiryDate && finalAcquisitionDate && suggestedValidity) {
            const acqDate = new Date(finalAcquisitionDate);
            if (!isNaN(acqDate.getTime())) {
                acqDate.setFullYear(acqDate.getFullYear() + Number(suggestedValidity));
                finalExpiryDate = acqDate.toISOString().split('T')[0];
            }
        }

        // Başvuru yenileme tarihi hesaplama
        let applicationDeadline = null;
        if (finalExpiryDate && renewalMonths) {
            const expiry = new Date(finalExpiryDate);
            if (!isNaN(expiry.getTime())) {
                expiry.setMonth(expiry.getMonth() - Number(renewalMonths));
                applicationDeadline = expiry.toISOString().split('T')[0];
            }
        }

        return {
            docType: docTypeStr,
            acquisitionDate: finalAcquisitionDate,
            expiryDate: finalExpiryDate,
            applicationDeadline: applicationDeadline,
            isIndefinite: rawResult.isIndefinite || false,
            suggestedValidityYears: suggestedValidity,
            renewalPeriodMonths: renewalMonths,
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
        const prompt = `"${docType}" isimli evrak türü hakkında Türkiye Cumhuriyeti yasal mevzuatına göre kısa ve öz bilgi ver. 
        Lütfen cevabı SADECE aşağıdaki JSON yapısında dön:
        {
          "description": "Bu evrak nedir ve ne işe yarar?",
          "validity": "Genel geçerlilik süresi nedir? (Örn: 2 yıl)",
          "renewal": "Yenilemek için bitişten kaç ay önce başvurulmalıdır?",
          "importance": "Bu evrağın eksikliği durumunda ne gibi yaptırımlar uygulanır?"
        }`;

        const responseText = await callGemini("gemini-2.0-flash", [{ role: "user", parts: [{ text: prompt }] }], 0.1, 512);

        if (!responseText) {
            console.warn("Gemini'den boş yanıt geldi (Mevzuat Analizi)");
            return null;
        }

        // JSON temizleme (Markdown bloklarını temizleyelim)
        let cleanedText = responseText.trim();
        if (cleanedText.startsWith('```')) {
            cleanedText = cleanedText.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error("AI Yanıtında JSON bulunamadı:", cleanedText);
            return null;
        }

        return JSON.parse(jsonMatch[0]);
    } catch (error: any) {
        console.error("getDocTypeInfo AI Hatası:", error?.message || error);
        return null;
    }
}
