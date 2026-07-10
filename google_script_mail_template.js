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
 * E-Posta Ayarları altındaki Google Script URL alanına kaydedin.
 */

function doPost(e) {
  try {
    // Gelen JSON verisini parse et
    var data = JSON.parse(e.postData.contents);

    // EvrakLab veritabanındaki günlük cron işleri (send_expiry_reminders, send_client_contract_reminders)
    // bu scripti farklı bir veri şekliyle çağırır: { to, cc, subject, html } — hazır HTML'i doğrudan gönderir.
    if (data.to && data.html) {
      var mailOptions = {
        to: data.to,
        subject: data.subject || 'EvrakLab Bildirimi',
        htmlBody: data.html
      };
      if (data.cc) mailOptions.cc = data.cc;
      MailApp.sendEmail(mailOptions);
      return ContentService.createTextOutput(JSON.stringify({ status: "success" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    var email = data.email;
    var clientName = data.clientName;
    var loginLink = data.loginLink;
    var type = data.type || 'invite'; // 'invite' | 'action_opened' | 'action_completed' | 'team_invite' | 'team_invite_register' | 'evaluation_invite' | 'document_request_created' | 'document_request_fulfilled'

    var subject, htmlBody;

    if (type === 'evaluation_invite') {
      // Danışmanlık firması, hizmet verdiği bir müşteri firmaya, atanan personelini
      // değerlendirmesi için tek kullanımlık bir anket bağlantısı gönderdiğinde kullanılır.
      var staffName = data.staffName || 'Danışmanınız';
      var evaluationLink = data.evaluationLink;

      subject = "EvrakLab - " + staffName + " İçin Değerlendirme Anketiniz Hazır";

      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Danışman Değerlendirme Anketi" +
            "</p>" +
          "</div>" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Sayın " + clientName + "," +
            "</h2>" +
            "<p style='margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              "Size hizmet veren çevre danışmanınız <b>" + staffName + "</b> için kısa bir memnuniyet değerlendirmesi hazırladık. " +
              "Görüşleriniz danışmanlık hizmet kalitesinin takibi için bizim için önemli. Anket, giriş yapmanızı gerektirmeden aşağıdaki bağlantı üzerinden tek seferlik doldurulabilir." +
            "</p>" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;'>" +
              "<a href='" + evaluationLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;'>Değerlendirmeyi Doldur</a>" +
            "</div>" +
          "</div>" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    } else if (type === 'team_invite' || type === 'team_invite_register') {
      // Bir şirket/danışmanlık firması, sisteme e-posta ile ekip daveti gönderdiğinde kullanılır.
      // 'team_invite': davet edilen kişi zaten EvrakLab'e kayıtlı, sadece giriş yapıp bildirimlerinden
      //                daveti onaylaması gerekiyor.
      // 'team_invite_register': davet edilen kişi sisteme kayıtlı değil, linke tıklayıp kayıt olduğunda
      //                otomatik olarak şirkete katılıyor.
      var orgName = data.orgName || 'Bir firma';
      var isNewUser = type === 'team_invite_register';

      subject = "EvrakLab - " + orgName + " Sizi Ekibine Davet Etti";

      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Ekip Daveti" +
            "</p>" +
          "</div>" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Merhaba," +
            "</h2>" +
            "<p style='margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              "<b>" + orgName + "</b> sizi EvrakLab üzerinde ekibine katılmaya davet etti. " +
              (isNewUser
                ? "Daveti kabul etmek ve firmaya katılmak için önce ücretsiz bir hesap oluşturmanız gerekiyor. Aşağıdaki bağlantıya tıklayarak kayıt olduğunuzda şirkete otomatik olarak katılmış olacaksınız."
                : "Daveti kabul etmek için EvrakLab hesabınıza giriş yapıp Bildirimler sayfasından \"Onayla\" butonuna tıklamanız yeterli.") +
            "</p>" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;'>" +
              "<a href='" + loginLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;'>" +
                (isNewUser ? "Hesap Oluştur ve Katıl" : "Bildirimlerime Git") +
              "</a>" +
            "</div>" +
          "</div>" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    } else if (type === 'action_opened' || type === 'action_completed') {
      var actionTitle = data.actionTitle || 'Aksiyon';
      var dueDate = data.dueDate || '';
      var isOpened = type === 'action_opened';

      subject = isOpened
        ? "EvrakLab - Yeni Aksiyon Tanımlandı: " + actionTitle
        : "EvrakLab - Aksiyon Tamamlandı: " + actionTitle;

      var badgeColor = isOpened ? '#f59e0b' : '#10b981';
      var badgeBg = isOpened ? '#fffbeb' : '#ecfdf5';
      var badgeText = isOpened ? 'YENİ AKSİYON' : 'TAMAMLANDI';

      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Aksiyon Takip Bildirimi" +
            "</p>" +
          "</div>" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Sayın " + clientName + "," +
            "</h2>" +
            "<p style='margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              (isOpened
                ? "Firmanız için EvrakLab sisteminde yeni bir aksiyon/yapılacak iş tanımlanmıştır. Detayları görmek ve gerekli belgeleri yüklemek için müşteri panelinize giriş yapabilirsiniz."
                : "Firmanız için tanımlanan aşağıdaki aksiyon tamamlandı olarak işaretlenmiştir.") +
            "</p>" +
            "<div style='border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background-color: #ffffff;'>" +
              "<div style='padding: 16px; border-bottom: 1px solid #f1f5f9;'>" +
                "<span style='font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;'>Aksiyon</span>" +
                "<div style='font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;'>" + actionTitle + "</div>" +
              "</div>" +
              (dueDate ? (
                "<div style='padding: 16px; display: flex; justify-content: space-between;'>" +
                  "<span style='font-size: 12px; font-weight: 600; color: #64748b;'>Hedef Tarih</span>" +
                  "<span style='font-size: 13px; font-weight: 700; color: #334155;'>" + dueDate + "</span>" +
                "</div>"
              ) : "") +
              "<div style='padding: 0 16px 16px 16px; text-align: right;'>" +
                "<span style='display: inline-block; background-color: " + badgeBg + "; color: " + badgeColor + "; border: 1px solid " + badgeColor + "; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px;'>" + badgeText + "</span>" +
              "</div>" +
            "</div>" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;'>" +
              "<a href='" + loginLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;'>EvrakLAB Paneline Git</a>" +
            "</div>" +
          "</div>" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    } else if (type === 'document_request_created') {
      // Danışman personeli, hizmet verdiği bir işletmeden serbest metinli bir
      // belge talep ettiğinde müşteriye gönderilir (bkz. ConsultantPanel.tsx
      // handleCreateDocumentRequest).
      var docReqTitle = data.title || 'Belge';
      var docReqDesc = data.description || '';

      subject = "EvrakLab - Yeni Evrak Talebi: " + docReqTitle;

      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Evrak Talebi Bildirimi" +
            "</p>" +
          "</div>" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Sayın " + clientName + "," +
            "</h2>" +
            "<p style='margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              "Danışmanlık firmanız sizden aşağıdaki belgeyi talep etti. Belgeyi yüklemek için müşteri panelinize giriş yapabilirsiniz." +
            "</p>" +
            "<div style='border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background-color: #ffffff;'>" +
              "<div style='padding: 16px;" + (docReqDesc ? " border-bottom: 1px solid #f1f5f9;" : "") + "'>" +
                "<span style='font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;'>Talep Edilen Belge</span>" +
                "<div style='font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;'>" + docReqTitle + "</div>" +
              "</div>" +
              (docReqDesc ? (
                "<div style='padding: 16px;'>" +
                  "<span style='font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;'>Not</span>" +
                  "<div style='font-size: 13px; color: #334155; margin-top: 4px;'>" + docReqDesc + "</div>" +
                "</div>"
              ) : "") +
            "</div>" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;'>" +
              "<a href='" + loginLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;'>Müşteri Paneline Git</a>" +
            "</div>" +
          "</div>" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    } else if (type === 'document_request_fulfilled') {
      // Müşteri, kendisinden talep edilen belgeyi müşteri panelinden yüklediğinde
      // talebi açan danışman personeline gönderilir (bkz. ClientPanel.tsx
      // handleFulfillDocumentRequest).
      var fulfilledTitle = data.title || 'Belge';

      subject = "EvrakLab - Evrak Talebi Karşılandı: " + fulfilledTitle;

      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Evrak Talebi Bildirimi" +
            "</p>" +
          "</div>" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Merhaba," +
            "</h2>" +
            "<p style='margin: 0 0 20px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              "<b>" + clientName + "</b> firması, sizin açtığınız aşağıdaki evrak talebine belge yükledi." +
            "</p>" +
            "<div style='border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px; background-color: #ffffff;'>" +
              "<div style='padding: 16px; text-align: right;'>" +
                "<span style='font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; float: left;'>Karşılanan Talep</span>" +
                "<span style='display: inline-block; background-color: #ecfdf5; color: #10b981; border: 1px solid #10b981; padding: 4px 10px; font-size: 11px; font-weight: 700; border-radius: 6px;'>KARŞILANDI</span>" +
                "<div style='clear: both; font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px; text-align: left;'>" + fulfilledTitle + "</div>" +
              "</div>" +
            "</div>" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center;'>" +
              "<a href='" + loginLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px;'>Danışman Paneline Git</a>" +
            "</div>" +
          "</div>" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    } else {
      subject = "EvrakLab Müşteri Portalı Şifre Belirleme Bağlantısı";

      // Şık, modern ve kurumsal HTML E-posta Tasarımı (Görseldeki premium stile uygun)
      htmlBody =
        "<div style='font-family: \"Segoe UI\", Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 0; background-color: #f8fafc; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);'>" +
          "<!-- Header Card (Blue Box) -->" +
          "<div style='background: linear-gradient(135deg, #5856d6, #4f46e5); padding: 35px 20px; text-align: center; color: #ffffff;'>" +
            "<h1 style='margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; line-height: 1.2;'>" +
              "Evrak<span style='color: #a5f3fc;'>LAB</span>" +
            "</h1>" +
            "<p style='margin: 8px 0 0 0; font-size: 14px; font-weight: 600; opacity: 0.9; letter-spacing: 0.5px;'>" +
              "Otomatik Müşteri Portalı Şifre Kurulum Servisi" +
            "</p>" +
          "</div>" +

          "<!-- Body Content -->" +
          "<div style='padding: 30px 25px; background-color: #ffffff;'>" +
            "<h2 style='margin: 0 0 16px 0; font-size: 20px; font-weight: 750; color: #0f172a;'>" +
              "Sayın " + clientName + "," +
            "</h2>" +
            "<p style='margin: 0 0 24px 0; font-size: 14px; color: #475569; line-height: 1.6;'>" +
              "EvrakLab sisteminde firmanıza özel bir müşteri giriş hesabı tanımlanmıştır. Çevre danışmanınız tarafından paylaşılan evrakları, atık yönetim kayıtlarınızı ve diğer yasal uyum süreçlerinizi takip edebilmek için giriş şifrenizi belirlemeniz gerekmektedir." +
            "</p>" +

            "<!-- Table Card Container -->" +
            "<div style='border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px; background-color: #ffffff;'>" +
              "<table style='width: 100%; border-collapse: collapse; text-align: left;'>" +
                "<thead>" +
                  "<tr style='background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;'>" +
                    "<th style='padding: 12px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;'>BELGE ADI</th>" +
                    "<th style='padding: 12px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;'>DETAYLAR</th>" +
                    "<th style='padding: 12px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;'>GEÇERLİLİK TARİHİ</th>" +
                    "<th style='padding: 12px 16px; font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; text-align: right;'>DURUM</th>" +
                  "</tr>" +
                "</thead>" +
                "<tbody>" +
                  "<tr>" +
                    "<td style='padding: 16px; font-size: 13px; font-weight: 700; color: #0f172a; border-bottom: 1px solid #f1f5f9;'>Müşteri Giriş Portalı</td>" +
                    "<td style='padding: 16px; font-size: 12px; color: #64748b; border-bottom: 1px solid #f1f5f9; line-height: 1.4;'>" +
                      "<span style='font-weight: 600;'>Tür:</span> Müşteri Paneli<br/>" +
                      "<span style='font-weight: 600; color: #94a3b8;'>Lokasyon:</span> EvrakLab" +
                    "</td>" +
                    "<td style='padding: 16px; font-size: 12px; color: #334155; border-bottom: 1px solid #f1f5f9; font-weight: 600;'>Süresiz</td>" +
                    "<td style='padding: 16px; border-bottom: 1px solid #f1f5f9; text-align: right;'>" +
                      "<span style='display: inline-block; background-color: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; padding: 4px 10px; font-size: 11px; font-weight: 700; white-space: nowrap; border-radius: 6px;'>" +
                        "🔑 Aktif Et" +
                      "</span>" +
                    "</td>" +
                  "</tr>" +
                "</tbody>" +
              "</table>" +
            "</div>" +

            "<!-- Username Info Box -->" +
            "<div style='background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 14px 18px; border-radius: 12px; text-align: center; margin-bottom: 16px;'>" +
              "<p style='margin: 0; font-size: 12px; color: #1e40af; line-height: 1.5;'>" +
                "<span style='font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;'>Kullanıcı Adınız (Giriş E-postanız):</span><br/>" +
                "<span style='font-weight: 800; font-size: 15px; color: #1d4ed8;'>" + email + "</span>" +
              "</p>" +
            "</div>" +

            "<!-- Action Card (Footer Area) -->" +
            "<div style='background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 10px;'>" +
              "<p style='margin: 0 0 16px 0; font-size: 13px; color: #475569; line-height: 1.5; font-weight: 600;'>" +
                "Giriş şifrenizi belirlemek, giriş yapmak ve atık kayıtlarınızı incelemek için EvrakLAB müşteri paneline giriş yapabilirsiniz." +
              "</p>" +
              "<a href='" + loginLink + "' style='display: inline-block; background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 700; font-size: 14px; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); transition: all 0.2s;'>EvrakLAB Paneline Git</a>" +
            "</div>" +
          "</div>" +

          "<!-- Footer -->" +
          "<div style='padding: 20px; text-align: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0;'>" +
            "<p style='margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5;'>" +
              "Bu e-posta EvrakLab portalı üzerinden otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız." +
            "</p>" +
          "</div>" +
        "</div>";
    }

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
