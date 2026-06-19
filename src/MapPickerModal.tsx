import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';

interface MapPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialLat?: number | null;
  initialLng?: number | null;
  onSelect: (lat: number, lng: number, address?: string) => void;
}

export const MapPickerModal: React.FC<MapPickerModalProps> = ({
  isOpen,
  onClose,
  initialLat,
  initialLng,
  onSelect,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  const [lat, setLat] = useState<number>(initialLat || 39.9334); // Center of Turkey
  const [lng, setLng] = useState<number>(initialLng || 32.8597);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState('');

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

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          searchQuery
        )}&limit=1`,
        {
          headers: {
            'Accept-Language': 'tr',
            'User-Agent': 'EvrakLab-Environmental-Waste-Module/1.0',
          },
        }
      );
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.length > 0) {
        const foundLat = parseFloat(data[0].lat);
        const foundLng = parseFloat(data[0].lon);
        
        setLat(foundLat);
        setLng(foundLng);
        
        if (mapRef.current) {
          mapRef.current.setView([foundLat, foundLng], 14);
          
          if (markerRef.current) {
            markerRef.current.setLatLng([foundLat, foundLng]);
          } else {
            const L = (window as any).L;
            markerRef.current = L.marker([foundLat, foundLng]).addTo(mapRef.current);
          }
        }
        
        const addr = data[0].display_name || '';
        setSelectedAddress(addr);
      } else {
        alert('Aranan konum bulunamadı.');
      }
    } catch (err) {
      console.error('Konum aranırken hata:', err);
    } finally {
      setSearching(false);
    }
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
      const zoomLevel = (initialLat && initialLng) ? 14 : 6;

      const map = L.map(mapContainer).setView([startLat, startLng], zoomLevel);
      mapRef.current = map;

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      // Create initial marker if coordinates were provided
      if (initialLat && initialLng) {
        markerRef.current = L.marker([startLat, startLng]).addTo(map);
      }

      // Handle map clicks
      map.on('click', async (e: any) => {
        const { lat: clickedLat, lng: clickedLng } = e.latlng;
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
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-[1000] p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border flex flex-col h-[550px] overflow-hidden animate-scaleIn">
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
            placeholder="Adres, şehir veya mahalle arayın..."
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
          </div>
          <div className="flex gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100 transition"
            >
              İptal
            </button>
            <button
              onClick={() => onSelect(lat, lng, selectedAddress)}
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
