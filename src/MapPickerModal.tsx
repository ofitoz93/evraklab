import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X, Pencil, Undo2, Trash2, Satellite, Map as MapIcon } from 'lucide-react';

const TILE_LAYERS = {
  street: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  },
  // Esri World Imagery - API anahtarı gerektirmeyen ücretsiz uydu görüntüsü.
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics',
  },
};

export interface AreaPoint {
  lat: number;
  lng: number;
}

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  initialAreaPoints?: AreaPoint[] | null;
  onSelect: (lat: number, lng: number, address?: string, areaPoints?: AreaPoint[] | null) => void;
}

// Küçük alanlar (birkaç yüz metre) için düzlemsel yaklaşıklıkla m² hesaplama (shoelace formülü).
export function calculatePolygonAreaM2(points: AreaPoint[]): number {
  if (points.length < 3) return 0;
  const refLat = points[0].lat;
  const latToM = 110540; // 1 derece enlem ~ 110.54 km
  const lngToM = 111320 * Math.cos((refLat * Math.PI) / 180); // 1 derece boylam (enleme göre değişir)

  const projected = points.map((p) => ({
    x: p.lng * lngToM,
    y: p.lat * latToM,
  }));

  let area = 0;
  for (let i = 0; i < projected.length; i++) {
    const p1 = projected[i];
    const p2 = projected[(i + 1) % projected.length];
    area += p1.x * p2.y - p2.x * p1.y;
  }
  return Math.abs(area / 2);
}

export function formatArea(m2: number): string {
  if (m2 >= 10000) return `${(m2 / 10000).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} hektar`;
  return `${m2.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} m²`;
}

// Nominatim, "Cd." "Sk." gibi kısaltmaları OSM verisindeki tam haliyle (Caddesi, Sokak)
// eşleştiremeyebiliyor; bu yüzden yaygın kısaltmaları açıyoruz.
function expandTurkishAbbreviations(q: string): string {
  return q
    .replace(/\bCd\.?\b/gi, 'Caddesi')
    .replace(/\bSk\.?\b/gi, 'Sokak')
    .replace(/\bSok\.?\b/gi, 'Sokak')
    .replace(/\bMah\.?\b/gi, 'Mahallesi')
    .replace(/\bBlv\.?\b/gi, 'Bulvarı')
    .replace(/\bApt\.?\b/gi, 'Apartmanı');
}

// Girilen adresi, tam eşleşme başarısız olursa denenecek şekilde adım adım
// sadeleştirilmiş varyantlara ayırır: kısaltmalar açılır, posta kodu ve kapı
// numarası çıkarılır, en başta yer alan (genelde site/tesis adı olan ve OSM'de
// bulunmayan) kısım atılır. Böylece "Kayapa Çamlık, Sarılar Cd. No:4,
// 16315 Nilüfer/Bursa" gibi bir adres tam bulunamasa bile en azından sokağa
// veya mahalleye kadar yaklaşılabilir.
function buildSearchVariants(rawQuery: string): string[] {
  const trimmed = rawQuery.trim();
  const variants: string[] = [];
  const pushIfNew = (v: string) => {
    const clean = v.replace(/\s{2,}/g, ' ').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim();
    if (clean.length > 2 && !variants.includes(clean)) variants.push(clean);
  };

  pushIfNew(trimmed);
  const expanded = expandTurkishAbbreviations(trimmed);
  pushIfNew(expanded);

  const noPostal = expanded.replace(/\b\d{5}\b/g, '');
  pushIfNew(noPostal);

  const noHouseNo = noPostal.replace(/\bNo:?\s*\d+\/?\w*\b/gi, '');
  pushIfNew(noHouseNo);

  // İlk virgülden önceki kısmı at (çoğunlukla site/tesis adı, OSM'de kayıtlı olmayabilir)
  const firstComma = noHouseNo.indexOf(',');
  if (firstComma > 0) {
    pushIfNew(noHouseNo.slice(firstComma + 1));
  }

  return variants;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  initialAreaPoints,
  onSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const polygonRef = useRef<any>(null);
  const vertexMarkersRef = useRef<any[]>([]);
  const tileLayerRef = useRef<any>(null);
  const [mapView, setMapView] = useState<'street' | 'satellite'>('satellite');

  const [lat, setLat] = useState<number>(initialLat || 39.9334); // Center of Turkey
  const [lng, setLng] = useState<number>(initialLng || 32.8597);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const [drawMode, setDrawMode] = useState(false);
  const [areaPoints, setAreaPoints] = useState<AreaPoint[]>(initialAreaPoints || []);
  const drawModeRef = useRef(drawMode);
  useEffect(() => {
    drawModeRef.current = drawMode;
  }, [drawMode]);

  // Reverse geocode function using Nominatim
  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'Accept-Language': 'tr',
            'User-Agent': 'EvrakLab-Environmental-Waste-Module/1.0',
          },
        }
      );
      if (!response.ok) return '';
      const data = await response.json();
      return data.display_name || '';
    } catch (err) {
      console.error('Adres çözümlenirken hata:', err);
      return '';
    }
  };

  const [usedFallbackQuery, setUsedFallbackQuery] = useState<string | null>(null);

  const fetchNominatimSearch = async (query: string): Promise<any[]> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&limit=8&addressdetails=1&countrycodes=tr`,
        {
          headers: {
            'Accept-Language': 'tr',
            'User-Agent': 'EvrakLab-Environmental-Waste-Module/1.0',
          },
        }
      );
      if (!response.ok) return [];
      const data = await response.json();
      return data || [];
    } catch (err) {
      console.error('Konum aranırken hata:', err);
      return [];
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    setSearchResults([]);
    setUsedFallbackQuery(null);
    try {
      const variants = buildSearchVariants(searchQuery);
      for (let i = 0; i < variants.length; i++) {
        const data = await fetchNominatimSearch(variants[i]);
        if (data.length > 0) {
          setSearchResults(data);
          if (i > 0) setUsedFallbackQuery(variants[i]);
          setSearching(false);
          return;
        }
        // Nominatim kullanım politikası: art arda istekler arasında kısa bekleme
        if (i < variants.length - 1) await new Promise((r) => setTimeout(r, 300));
      }
      alert('Aranan konum bulunamadı. Adres OpenStreetMap üzerinde kayıtlı değilse, sadece mahalle/cadde adıyla aramayı deneyin ya da uydu görünümüne geçip haritadan tam noktayı işaretleyin.');
    } finally {
      setSearching(false);
    }
  };

  const handleSelectSearchResult = (item: any) => {
    const foundLat = parseFloat(item.lat);
    const foundLng = parseFloat(item.lon);

    setLat(foundLat);
    setLng(foundLng);

    if (mapRef.current) {
      mapRef.current.setView([foundLat, foundLng], 17);

      if (markerRef.current) {
        markerRef.current.setLatLng([foundLat, foundLng]);
      } else {
        const L = (window as any).L;
        markerRef.current = L.marker([foundLat, foundLng]).addTo(mapRef.current);
      }
    }

    setSelectedAddress(item.display_name || '');
    setSearchResults([]);
  };

  // Perform reverse geocoding on initial coordinates if they exist
  useEffect(() => {
    if (isOpen && initialLat && initialLng) {
      reverseGeocode(initialLat, initialLng).then((addr) => {
        setSelectedAddress(addr);
      });
    } else {
      setSelectedAddress('');
    }
  }, [isOpen, initialLat, initialLng]);

  useEffect(() => {
    if (isOpen) {
      setAreaPoints(initialAreaPoints || []);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const redrawPolygon = (points: AreaPoint[]) => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    vertexMarkersRef.current.forEach((m) => map.removeLayer(m));
    vertexMarkersRef.current = [];
    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    if (points.length > 0) {
      points.forEach((p) => {
        const vm = L.circleMarker([p.lat, p.lng], {
          radius: 5,
          color: '#2ca58d',
          fillColor: '#2ca58d',
          fillOpacity: 1,
        }).addTo(map);
        vertexMarkersRef.current.push(vm);
      });
    }

    if (points.length >= 2) {
      polygonRef.current = L.polygon(
        points.map((p) => [p.lat, p.lng]),
        { color: '#2ca58d', weight: 2, fillColor: '#2ca58d', fillOpacity: 0.2 }
      ).addTo(map);
    }
  };

  // Leaflet map initialization
  useEffect(() => {
    if (!isOpen) return;

    // Small delay to ensure the container is fully rendered in the DOM
    const timer = setTimeout(() => {
      const L = (window as any).L;
      if (!L) {
        console.error('Leaflet script is not loaded!');
        return;
      }

      // Configure Leaflet marker assets explicitly to prevent missing asset bundling issues
      const defaultIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41],
      });
      L.Marker.prototype.options.icon = defaultIcon;

      const mapContainer = mapContainerRef.current;
      if (!mapContainer) return;

      const startLat = initialLat || 39.9334;
      const startLng = initialLng || 32.8597;
      const zoomLevel = (initialLat && initialLng) ? 15 : 6;

      const map = L.map(mapContainer).setView([startLat, startLng], zoomLevel);
      mapRef.current = map;

      const initialTile = TILE_LAYERS[mapView];
      tileLayerRef.current = L.tileLayer(initialTile.url, {
        attribution: initialTile.attribution,
        maxZoom: 19,
      }).addTo(map);

      // Create initial marker if coordinates were provided
      if (initialLat && initialLng) {
        markerRef.current = L.marker([startLat, startLng]).addTo(map);
      }

      if (initialAreaPoints && initialAreaPoints.length > 0) {
        redrawPolygon(initialAreaPoints);
      }

      // Handle map clicks
      map.on('click', async (e: any) => {
        const { lat: clickedLat, lng: clickedLng } = e.latlng;

        if (drawModeRef.current) {
          setAreaPoints((prev) => {
            const next = [...prev, { lat: clickedLat, lng: clickedLng }];
            redrawPolygon(next);
            return next;
          });
          return;
        }

        setLat(clickedLat);
        setLng(clickedLng);

        if (markerRef.current) {
          markerRef.current.setLatLng([clickedLat, clickedLng]);
        } else {
          markerRef.current = L.marker([clickedLat, clickedLng]).addTo(map);
        }

        // Fetch address for user convenience
        const addr = await reverseGeocode(clickedLat, clickedLng);
        setSelectedAddress(addr);
      });

      // Fix sizes on load
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(timer);
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      polygonRef.current = null;
      vertexMarkersRef.current = [];
      tileLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Uydu / harita katmanı geçişi (haritayı yeniden kurmadan)
  useEffect(() => {
    const L = (window as any).L;
    const map = mapRef.current;
    if (!L || !map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const config = TILE_LAYERS[mapView];
    tileLayerRef.current = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: 19 }).addTo(map);
    tileLayerRef.current.bringToBack();
  }, [mapView]);

  const handleUndoPoint = () => {
    setAreaPoints((prev) => {
      const next = prev.slice(0, -1);
      redrawPolygon(next);
      return next;
    });
  };

  const handleClearArea = () => {
    setAreaPoints([]);
    redrawPolygon([]);
  };

  const areaM2 = areaPoints.length >= 3 ? calculatePolygonAreaM2(areaPoints) : 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border flex flex-col h-[600px] overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
            <MapPin className="text-[#2ca58d]" size={18} />
            Haritadan Konum Seçin
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
            <X size={20} />
          </button>
        </div>

        {/* Address Search */}
        <form onSubmit={handleSearch} className="p-3 border-b flex gap-2 bg-white">
          <input
            type="text"
            placeholder="Firma adı, adres, şehir veya mahalle arayın... (örn: Bursa Entegre)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 border px-3 py-1.5 rounded-xl text-xs outline-none focus:ring-1 focus:ring-[#2ca58d]"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-[#2ca58d] hover:bg-[#238c75] text-white px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-sm"
          >
            <Search size={14} />
            {searching ? 'Aranıyor...' : 'Ara'}
          </button>
        </form>

        {/* Search Results List */}
        {searchResults.length > 0 && (
          <div className="border-b bg-white max-h-40 overflow-y-auto">
            {usedFallbackQuery && (
              <div className="px-3 py-1.5 bg-amber-50 text-amber-700 text-[10px] font-bold border-b border-amber-100">
                Tam adres bulunamadı, sadeleştirilmiş arama kullanıldı: "{usedFallbackQuery}"
              </div>
            )}
            <div className="px-3 pt-2 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide flex items-center justify-between">
              <span>{searchResults.length} sonuç bulundu, doğru olanı seçin</span>
              <button
                type="button"
                onClick={() => setSearchResults([])}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={12} />
              </button>
            </div>
            {searchResults.map((item, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectSearchResult(item)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-teal-50 border-t border-slate-100 transition flex items-start gap-2"
              >
                <MapPin size={13} className="text-[#2ca58d] flex-shrink-0 mt-0.5" />
                <span className="text-slate-700 line-clamp-2">{item.display_name}</span>
              </button>
            ))}
          </div>
        )}

        {/* Area Draw Toolbar */}
        <div className="px-3 py-2 border-b bg-white flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMapView((v) => (v === 'street' ? 'satellite' : 'street'))}
            title="İşletme adı aramada bulunamıyorsa, uydu görünümüne geçip binayı gözle bulup tıklayabilirsiniz"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            {mapView === 'street' ? <Satellite size={13} /> : <MapIcon size={13} />}
            {mapView === 'street' ? 'Uydu Görünümü' : 'Harita Görünümü'}
          </button>
          <button
            type="button"
            onClick={() => setDrawMode((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
              drawMode ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Pencil size={13} /> {drawMode ? 'Alan Çizimi Açık (Haritaya Tıklayın)' : 'İşletme Alanını Çiz'}
          </button>
          {areaPoints.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleUndoPoint}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition"
              >
                <Undo2 size={13} /> Son Noktayı Sil
              </button>
              <button
                type="button"
                onClick={handleClearArea}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-red-50 text-red-600 hover:bg-red-100 transition"
              >
                <Trash2 size={13} /> Alanı Temizle
              </button>
              <span className="text-[11px] font-bold text-slate-500 ml-auto">
                {areaPoints.length} nokta{areaM2 > 0 ? ` · ${formatArea(areaM2)}` : ''}
              </span>
            </>
          )}
        </div>

        {/* Map Area */}
        <div className="flex-1 relative bg-slate-100">
          <div ref={mapContainerRef} className="absolute inset-0 w-full h-full" style={{ zIndex: 10 }} />
        </div>

        {/* Selected Coordinates & Address Footer */}
        <div className="p-4 bg-slate-50 border-t flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="text-left space-y-1 max-w-[70%]">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              Seçilen Koordinat
            </div>
            <div className="text-xs text-slate-700 font-mono font-bold">
              Enlem: {lat.toFixed(6)}, Boylam: {lng.toFixed(6)}
            </div>
            {selectedAddress && (
              <div className="text-[11px] text-gray-500 font-medium line-clamp-1" title={selectedAddress}>
                {selectedAddress}
              </div>
            )}
            {areaM2 > 0 && (
              <div className="text-[11px] text-teal-700 font-bold">
                İşletme Alanı: {formatArea(areaM2)}
              </div>
            )}
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
            >
              İptal
            </button>
            <button
              onClick={() => onSelect(lat, lng, selectedAddress, areaPoints.length >= 3 ? areaPoints : null)}
              className="px-4 py-2 bg-[#2ca58d] hover:bg-[#238c75] text-white rounded-xl text-xs font-bold transition shadow-md shadow-teal-50"
            >
              Konumu Seç
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
