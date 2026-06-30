/**
 * EVRAKLAB - MÜŞTERİ PANELİ DAVET MAİLİ GÖNDERME SCRİPTİ
 * 
 * Bu scripti Google Apps Script (https://script.google.com/) üzerinde yeni bir proje 
 * oluşturarak yapıştırın. Ardından "Dağıtın" (Deploy) -> "Yeni Dağıtım" (New Deployment) 
 * diyerek "Web Uygulaması" (Web App) olarak yayınlayın.
 * 
 * ÖNEMLİ AYARLAR:
 * - Yürütme biçimi (Execute as): "Ben" (Sizin Google Hesabınız)
 * - Erişim yetkisi (Who has access): "Herkes" (Anyone)
 * 
 * Dağıtım sonrasında oluşan Web App URL adresini kopyalayarak EvrakLab sisteminde 
 * Müşteri Giriş Yetkisi penceresindeki Google Apps Script URL alanına kaydedin.
 */

function doPost(e) {
  try {
    // Gelen JSON verisini parse et
    var data = JSON.parse(e.postData.contents);
    var email = data.email;
    var clientName = data.clientName;
    var loginLink = data.loginLink;
    
    var subject = "EvrakLab Müşteri Portalı Şifre Belirleme Bağlantısı";
    
    // Şık ve kurumsal HTML E-posta Tasarımı
    var htmlBody = 
      "<div style='font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;'>" +
        "<div style='text-align: center; margin-bottom: 25px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px;'>" +
          "<h2 style='color: #0d9488; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;'>EvrakLab</h2>" +
          "<p style='color: #64748b; font-size: 13px; margin: 5px 0 0 0; font-weight: 500;'>Çevre Yönetimi ve Evrak Portalı</p>" +
        "</div>" +
        "<div style='padding: 5px 0;'>" +
          "<p style='margin: 0 0 12px 0; font-size: 16px; color: #0f172a; line-height: 1.5;'>Sayın <strong>" + clientName + "</strong>,</p>" +
          "<p style='margin: 0 0 24px 0; font-size: 14px; color: #334155; line-height: 1.6;'>" +
            "Çevre danışmanlık firmanız tarafından EvrakLab sisteminde firmanıza özel bir müşteri giriş hesabı tanımlanmıştır. " +
            "Hesabınızı aktif hale getirmek ve giriş şifrenizi güvenli bir şekilde belirlemek için lütfen aşağıdaki butona tıklayın:" +
          "</p>" +
          "<div style='text-align: center; margin: 30px 0;'>" +
            "<a href='" + loginLink + "' style='background-color: #0d9488; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 4px 6px -1px rgba(13, 148, 136, 0.2);'>Şifre Belirle & Giriş Yap</a>" +
          "</div>" +
          "<div style='background-color: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 8px; margin-top: 25px;'>" +
            "<p style='margin: 0 0 8px 0; font-size: 11px; color: #64748b; font-weight: 600; text-uppercase: uppercase; letter-spacing: 0.5px;'>Bağlantı Sorunu Yaşarsanız:</p>" +
            "<p style='margin: 0; font-size: 12px; color: #0d9488; word-break: break-all; font-family: monospace;'>" +
              loginLink +
            "</p>" +
          "</div>" +
        "</div>" +
        "<div style='margin-top: 35px; border-top: 1px solid #f1f5f9; padding-top: 20px; text-align: center;'>" +
          "<p style='font-size: 11px; color: #94a3b8; margin: 0;'>" +
            "Bu e-posta EvrakLab portalı üzerinden talebiniz doğrultusunda otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
          "</p>" +
        "</div>" +
      "</div>";
    
    // E-posta gönderimi yap
    MailApp.sendEmail({
      to: email,
      subject: subject,
      htmlBody: htmlBody
    });
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
