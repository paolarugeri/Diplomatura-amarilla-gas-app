import { useEffect, useState } from 'react'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { Crosshair, MapPin, Trash2 } from 'lucide-react'

const pin = L.divIcon({
  className: '',
  html: `<svg width="36" height="46" viewBox="0 0 36 46" xmlns="http://www.w3.org/2000/svg"><path d="M18 0C8 0 0 8 0 18c0 13 18 28 18 28s18-15 18-28C36 8 28 0 18 0z" fill="#1f1f1c"/><circle cx="18" cy="18" r="8" fill="#ffb01d"/></svg>`,
  iconSize: [36, 46],
  iconAnchor: [18, 46],
})

const DEFAULT_CENTER: [number, number] = [-34.7631, -58.2117] // Berazategui

function ClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) })
  return null
}

function Recenter({ center }: { center: [number, number] | null }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, Math.max(map.getZoom(), 16))
  }, [center, map])
  return null
}

export function MapPicker({
  lat,
  lng,
  onChange,
}: {
  lat: number | null
  lng: number | null
  onChange: (lat: number | null, lng: number | null) => void
}) {
  const [locating, setLocating] = useState(false)
  const [geoError, setGeoError] = useState('')
  const [recenter, setRecenter] = useState<[number, number] | null>(null)
  const pos: [number, number] | null = lat != null && lng != null ? [lat, lng] : null

  function locate() {
    if (!navigator.geolocation) {
      setGeoError('Tu dispositivo no permite obtener la ubicación.')
      return
    }
    setLocating(true)
    setGeoError('')
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLocating(false)
        onChange(p.coords.latitude, p.coords.longitude)
        setRecenter([p.coords.latitude, p.coords.longitude])
      },
      () => {
        setLocating(false)
        setGeoError('No pudimos obtener tu ubicación. Marcala tocando el mapa.')
      },
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-line">
        <MapContainer center={pos ?? DEFAULT_CENTER} zoom={pos ? 16 : 13} className="h-60 w-full" scrollWheelZoom={false}>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickHandler onPick={(a, b) => onChange(a, b)} />
          <Recenter center={recenter} />
          {pos && (
            <Marker
              position={pos}
              icon={pin}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const ll = (e.target as L.Marker).getLatLng()
                  onChange(ll.lat, ll.lng)
                },
              }}
            />
          )}
        </MapContainer>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className="btn-outline px-3 py-2 text-sm" onClick={locate} disabled={locating}>
          <Crosshair className="size-4" /> {locating ? 'Buscando…' : 'Usar mi ubicación'}
        </button>
        {pos && (
          <button type="button" className="btn-ghost text-sm" onClick={() => onChange(null, null)}>
            <Trash2 className="size-4" /> Quitar marca
          </button>
        )}
        <span className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" />
          {pos ? 'Ubicación marcada. Podés arrastrar el pin para ajustarla.' : 'Opcional: tocá el mapa para marcar la entrada.'}
        </span>
      </div>
      {geoError && <p className="mt-1 text-sm font-semibold text-warn">{geoError}</p>}
    </div>
  )
}
