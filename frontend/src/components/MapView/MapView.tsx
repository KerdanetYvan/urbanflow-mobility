import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer } from 'react-leaflet';
import { formatDuration, formatTransfers } from '../../lib/format';
import type { GeoPosition } from '../../lib/useGeolocation';
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

/**
 * Position de l'utilisateur en temps reel (issue #9) - un point pulsant
 * pour se distinguer visuellement du marqueur "origine" (aussi un simple
 * disque), l'animation etant definie en CSS (MapView.css,
 * .mapview-user-marker-ring) plutot qu'en SVG pour rester une simple
 * transition de taille/opacite peu couteuse.
 */
const USER_POSITION_ICON = L.divIcon({
  className: 'mapview-marker mapview-user-marker',
  html: '<span class="mapview-user-marker-ring"></span><span class="mapview-user-marker-dot"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

interface MapViewProps {
  itinerary: TripItinerary;
  className?: string;
  /** Position de l'utilisateur en temps reel (issue #9), voir lib/useGeolocation.ts. Absente/null : aucun marqueur affiche, la carte reste utilisable sans geolocalisation. */
  userPosition?: GeoPosition | null;
  /**
   * 'boxed' (par defaut) : carte encadree de hauteur fixe, avec son propre
   * resume texte + legende affiches juste en dessous - comportement d'origine
   * de l'issue #8, verifie par MapView.spec.tsx.
   *
   * 'fullBleed' : la carte remplit tout son conteneur (pas de bordure/rayon),
   * sans resume ni legende sous elle - utilise par l'ecran de resultats
   * (#36) une fois la carte devenue le fond plein ecran de la page. Dans ce
   * mode, l'equivalent textuel WCAG 1.1.1 (resume + segments) est fourni
   * par les cards flottantes de ResultatsPage plutot que par ce composant.
   */
  variant?: 'boxed' | 'fullBleed';
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
 * (`aria-hidden`, comme documente dans la spec). En mode 'boxed', le resume
 * textuel et la legende ci-dessous sont l'alternative complete ; en mode
 * 'fullBleed', c'est a l'appelant (ResultatsPage) de fournir cette
 * alternative via ses propres cards, voir le commentaire sur `variant`.
 */
function MapView({
  itinerary,
  className,
  variant = 'boxed',
  userPosition,
}: MapViewProps) {
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

  const isFullBleed = variant === 'fullBleed';

  return (
    <div
      className={[
        'mapview',
        isFullBleed && 'mapview-full-bleed',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [24, 24] }}
        // Molette : desactivee en mode 'boxed' (comportement d'origine de
        // l'issue #8) pour ne pas capter le defilement de la page quand la
        // carte est un simple encart dans un flux normal ; activee en
        // 'fullBleed' (#36 v2) puisque la page elle-meme ne defile plus
        // (voir ResultatsPage.css) - rien a proteger.
        scrollWheelZoom={isFullBleed}
        // Pincement a deux doigts : deja actif par defaut dans Leaflet,
        // rendu explicite ici pour que l'intention soit claire (zoom
        // tactile attendu sur mobile, #36 v2).
        touchZoom
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
        {userPosition && (
          // Volontairement exclue du calcul de `bounds` ci-dessus : recadrer
          // la carte a chaque mise a jour de position (issue #9) ferait
          // sauter la vue en continu, genant pour lire le trace de
          // l'itineraire - l'utilisateur reste libre de deplacer la carte
          // pour se retrouver si besoin.
          <Marker
            position={[userPosition.lat, userPosition.lon]}
            icon={USER_POSITION_ICON}
          />
        )}
      </MapContainer>

      {!isFullBleed && (
        <>
          <p className="mapview-summary">
            De {origin.name} à {destination.name} :{' '}
            {formatDuration(itinerary.durationSeconds)},{' '}
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
        </>
      )}
    </div>
  );
}

export default MapView;
