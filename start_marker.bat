@echo off
echo [EvrakLab] Marker Sunucusu Kurulumu ve Baslatilmasi...
echo python --version
python --version
if %errorlevel% neq 0 (
    echo [HATA] Python bulunamadi! Lutfen Python yukleyin.
    pause
    exit /b
)

echo.
echo [1/2] Bagimliliklar kontrol ediliyor/yukleniyor...
pip install -r requirements_marker.txt

echo.
echo [2/2] Marker Sunucusu baslatiliyor (Port 8001)...
echo Bu islem ilk calistirmada modelleri indirecegi icin uzun surebilir (bir kac GB).
echo.
python -m marker.scripts.server --port 8001

pause
