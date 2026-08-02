import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import { formatDuration, formatTransfers } from '../../lib/format';
import type { TripItinerary } from '../../lib/trips';
import { getModeStyle } from './modeStyles';
import './MapView.css';

/**
 * Icones de marqueur en SVG inline (chaine HTML, pas JSX) : L.divIcon
 * attend une chaine, pas un composant React - on ne peut donc pas reutiliser
 * directement components/icons.tsx ici. Couleurs dupliquees depuis
 * styles/tokens.css volontairement (voir le commentaire de modeStyles.ts) :
 * une chaine HTML brute injectee par Leaflet est hors de portee normale de
 * la cascade CSS des variables du composant.
 */
const ORIGIN_ICON = L.divIcon({
  className: 'mapview-marker',
  html: '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="#2f6fed" stroke="#fff" stroke-width="2.5"/></svg>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

const DESTINATION_ICON = L.divIcon({
  className: 'mapview-marker',
  html: '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z" fill="#e23d3d" stroke="#fff" stroke-width="1.5"/><circle cx="12" cy="9.5" r="2.5" fill="#fff"/></svg>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

const TRANSFER_ICON = L.divIcon({
  className: 'mapview-marker',
  html: '<svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="4.5" fill="#fff" stroke="#6b6375" stroke-width="2.5"/></svg>',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

interface MapViewProps {
  itinerary: TripItinerary;
  className?: string;
}

/**
 * Affichage cartographique d'un itineraire (F2, issue #8) : trace de chaque
 * segment colore selon son mode (voir modeStyles.ts), suivant les rues/voies
 * reellement parcourues (segment.geometry, decode depuis OpenTripPlanner
 * cote backend - pas une simple ligne droite entre origine et destination),
 * marqueurs origine/destination/correspondances. Integree a l'ecran de
 * resultats (#36), pas une route separee (voir
 * docs/specs/f2-ecrans-planification.md section 3.3).
 *
 * Accessibilite (WCAG 1.1.1) : la carte elle-meme est un complement visuel
 * (`aria-hidden`, comme documente dans la spec - la liste + le detail texte
 * des segments, cote ecran de resultats, sont deja l'alternative complete).
 * Ce composant reste neanmoins accessible de facon autonome, sans dependre
 * de #36 : le resume textuel et la legende ci-dessous sont visibles (pas
 * seulement pour lecteur d'ecran), et la legende sert aussi de canal
 * secondaire pour l'identification des modes par couleur (voir modeStyles.ts).
 */
function MapView({ itinerary, className }: MapViewProps) {
  const segments = itinerary.segments;
  if (segments.length === 0) return null;

  const origin = segments[0].from;
  const destination = segments[segments.length - 1].to;
  // Points de correspondance = frontieres entre segments (le "from" de tout
  // segment sauf le premier, deja marque comme origine).
  const transferPoints = segments.slice(1).map((segment) => segment.from);

  const bounds = L.latLngBounds(
    segments.flatMap((segment) =>
      segment.geometry.map(
        (point) => [point.lat, point.lon] as [number, number],
      ),
    ),
  );

  // Legende : un seul badge par mode present dans l'itineraire, dans
  // l'ordre de premiere apparition (pas d'ordre alphabetique arbitraire).
  const modesUsed = [...new Set(segments.map((segment) => segment.mode))];

  return (
    <div className={['mapview', className].filter(Boolean).join(' ')}>
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        scrollWheelZoom={false}
        className="mapview-container"
        aria-hidden="true"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {segments.map((segment, index) => {
          const style = getModeStyle(segment.mode);
          return (
            <Polyline
              key={index}
              // Suit les rues/voies reellement parcourues (issue #8), pas
              // une simple ligne entre les deux extremites - voir
              // TripSegment#geometry (backend/src/trips/trips.service.ts,
              // decode le legGeometry renvoye par OpenTripPlanner).
              positions={segment.geometry.map(
                (point) => [point.lat, point.lon] as [number, number],
              )}
              pathOptions={{
                color: style.color,
                weight: 4,
                dashArray: style.dashed ? '2 10' : undefined,
                lineCap: 'round',
              }}
            />
          );
        })}
        <Marker position={[origin.lat, origin.lon]} icon={ORIGIN_ICON} />
        <Marker
          position={[destination.lat, destination.lon]}
          icon={DESTINATION_ICON}
        />
        {transferPoints.map((point, index) => (
          <Marker
            key={index}
            position={[point.lat, point.lon]}
            icon={TRANSFER_ICON}
          />
        ))}
      </MapContainer>

      <p className="mapview-summary">
        De {origin.name} à {destination.name} : {formatDuration(itinerary.durationSeconds)},{' '}
        {formatTransfers(itinerary.transfers).toLowerCase()}.
      </p>

      <ul className="mapview-legend">
        {modesUsed.map((mode) => {
          const style = getModeStyle(mode);
          return (
            <li key={mode} className="mapview-legend-item">
              <span
                className="mapview-legend-swatch"
                style={{ background: style.color }}
                aria-hidden="true"
              />
              {style.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default MapView;
