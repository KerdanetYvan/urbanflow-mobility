import { useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Polyline, TileLayer, useMap } from 'react-leaflet';
import { formatDuration, formatTransfers } from '../../lib/format';
import type { SharedMobilityStation } from '../../lib/sharedMobility';
import type { GeoPosition } from '../../lib/useGeolocation';
import type { TripItinerary, TripPlace } from '../../lib/trips';
import { chipLabel, tripModeChips } from '../../lib/tripModeChips';
import { getModeStyle } from './modeStyles';
import { getSegmentColor } from './segmentColor';
import { useSharedMobilityStations } from './useSharedMobilityStations';
import './MapView.css';

/**
 * Icones de marqueur en SVG inline (chaine HTML, pas JSX) : L.divIcon
 * attend une chaine, pas un composant React - on ne peut donc pas reutiliser
 * directement components/icons.tsx ici. Couleurs de DESTINATION_ICON/
 * TRANSFER_ICON dupliquees en dur depuis styles/tokens.css (voir le
 * commentaire de modeStyles.ts) - une chaine HTML brute injectee par
 * Leaflet est bien inseree dans le document reel, mais on evite ici de
 * dependre d'une variable pour des teintes fixes (rouge destination, gris
 * correspondance) qui n'ont pas de contrepartie theme clair/sombre a suivre.
 * ORIGIN_ICON fait exception (issue #158) : var(--color-primary-emphasis)
 * fonctionne normalement ici, les proprietes CSS personnalisees du :root
 * s'appliquent a tout noeud du document quelle que soit sa methode
 * d'insertion (innerHTML compris) - necessaire cette fois pour suivre les
 * deux valeurs distinctes du token entre themes clair et sombre.
 */
const ORIGIN_ICON = L.divIcon({
  className: 'mapview-marker',
  html: '<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="6" fill="var(--color-primary-emphasis)" stroke="#fff" stroke-width="2.5"/></svg>',
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
 * Icone d'une station/vehicule en libre-service (velos, trottinettes -
 * issue #13). Dynamique (une par station, contrairement aux icones fixes
 * ci-dessus) : le badge affiche le nombre de velos disponibles a l'instant,
 * ne peut donc pas etre une constante calculee une seule fois au chargement
 * du module. Couleur = disponibilite reelle (var(--color-success) au moins
 * un velo louable, sinon var(--color-text-muted) - station fermee a la
 * location OU a quai plein/vide) plutot qu'une seule couleur "station GBFS"
 * fixe : c'est la disponibilite, pas la simple presence d'une station, qui
 * interesse l'usager sur cette carte.
 */
function sharedMobilityIcon(station: SharedMobilityStation): L.DivIcon {
  const isAvailable = station.isRenting && station.bikesAvailable > 0;
  const fill = isAvailable ? 'var(--color-success)' : 'var(--color-text-muted)';
  return L.divIcon({
    className: 'mapview-marker',
    html: `<svg width="20" height="20" viewBox="0 0 20 20"><circle cx="10" cy="10" r="9" fill="${fill}" stroke="#fff" stroke-width="2"/><text x="10" y="10" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="#fff">${station.bikesAvailable}</text></svg>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

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

/** Simple point lat/lon, sans les metadonnees d'un TripPlace (nom...). */
interface LatLon {
  lat: number;
  lon: number;
}

/**
 * Point de reference par defaut (centre-ville de Rennes) affiche quand ni
 * itineraire ni origine/destination ne sont encore connus - issue #110/#111,
 * carte permanente sur l'etat "formulaire". Memes coordonnees que le point
 * de reference cote backend (WeatherService, meme raison : une zone
 * generale pour la metropole, pas une position precise d'usager).
 */
const RENNES_METROPOLE_CENTER: LatLon = { lat: 48.1173, lon: -1.6778 };
const DEFAULT_ZOOM = 13;
const SINGLE_POINT_ZOOM = 15;

interface MapViewProps {
  /**
   * Absent pendant une recherche en cours (issue #73, spec 2.4 - aucun
   * itineraire recu du backend pour l'instant) : fournir alors `origin`/
   * `destination` pour afficher seulement les deux marqueurs, sans trace.
   */
  itinerary?: TripItinerary;
  /** Utilises uniquement quand `itinerary` est absent (recherche en cours). */
  origin?: LatLon;
  destination?: LatLon;
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
   * par les cards flottantes de RecherchePageResults plutot que par ce
   * composant.
   */
  variant?: 'boxed' | 'fullBleed';
}

/**
 * Recadre la carte de facon imperative quand la "forme" de la vue change
 * (nouvel itineraire selectionne, passage d'un point a deux, retour a la vue
 * par defaut...), sans remonter l'instance Leaflet.
 *
 * Eco-conception (issue #23, voir docs/audits/eco-conception.md section 6) :
 * l'implementation precedente forcait un remontage complet du <MapContainer>
 * via une `key` derivee des bounds - a chaque selection d'itineraire, tout le
 * DOM de la carte etait detruit puis recree et l'integralite des tuiles
 * rechargee. Ce composant enfant applique le nouveau cadrage sur la meme
 * instance : seules les tuiles reellement nouvelles sont demandees (et le
 * cache runtime du service worker sert celles deja vues).
 *
 * Les props sont volontairement toutes des scalaires (pas d'objet `bounds`
 * ni de tuple `center`, recrees a chaque rendu de MapView et donc inutiles
 * en dependance d'effet) : ce sont ces scalaires eux-memes qui declenchent
 * le recadrage quand ils changent, et l'effet peut tous les lister en
 * dependances sans avertissement `react-hooks/exhaustive-deps`.
 *
 * @param swLat,swLng,neLat,neLng  coins sud-ouest / nord-est du rectangle a
 *   cadrer ; tous `undefined` quand il n'y a pas au moins deux points.
 * @param centerLat,centerLon  centre fixe a afficher quand il n'y a pas de
 *   rectangle (un seul point, ou vue par defaut).
 * @param zoom  niveau de zoom associe au centre fixe.
 * @returns rien (composant de pilotage, pas de rendu propre).
 */
function MapViewController({
  swLat,
  swLng,
  neLat,
  neLng,
  centerLat,
  centerLon,
  zoom,
}: {
  swLat: number | undefined;
  swLng: number | undefined;
  neLat: number | undefined;
  neLng: number | undefined;
  centerLat: number;
  centerLon: number;
  zoom: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (
      swLat !== undefined &&
      swLng !== undefined &&
      neLat !== undefined &&
      neLng !== undefined
    ) {
      // Meme marge que l'ancien `boundsOptions` du <MapContainer>.
      map.fitBounds(
        L.latLngBounds([
          [swLat, swLng],
          [neLat, neLng],
        ]),
        { padding: [24, 24] },
      );
    } else {
      map.setView([centerLat, centerLon], zoom);
    }
  }, [map, swLat, swLng, neLat, neLng, centerLat, centerLon, zoom]);

  return null;
}

/**
 * Affichage cartographique d'un itineraire (F2, issue #8) : trace de chaque
 * segment colore selon son mode (voir modeStyles.ts), suivant les rues/voies
 * reellement parcourues (segment.geometry, decode depuis OpenTripPlanner
 * cote backend - pas une simple ligne droite entre origine et destination),
 * marqueurs origine/destination/correspondances. Integree a l'ecran de
 * recherche/resultats fusionne (#36, #73), pas une route separee (voir
 * docs/specs/f2-ecrans-planification.md section 3.3 et
 * docs/specs/refonte-visuelle-mobile-desktop.md section 2).
 *
 * Accessibilite (WCAG 1.1.1) : la carte elle-meme est un complement visuel
 * (`aria-hidden`, comme documente dans la spec). En mode 'boxed', le resume
 * textuel et la legende ci-dessous sont l'alternative complete ; en mode
 * 'fullBleed', c'est a l'appelant (RecherchePageResults) de fournir cette
 * alternative via ses propres cards, voir le commentaire sur `variant`.
 */
function MapView({
  itinerary,
  origin: originProp,
  destination: destinationProp,
  className,
  variant = 'boxed',
  userPosition,
}: MapViewProps) {
  // Stations/vehicules en libre-service (issue #13) - couche independante
  // de l'itineraire recherche, affichee en permanence (comme la carte
  // elle-meme, #110) plutot que seulement pendant tel ou tel etat de
  // recherche : elle aide a planifier le premier/dernier kilometre a pied,
  // avant meme d'avoir lance une recherche.
  const sharedMobilityStations = useSharedMobilityStations();

  const segments = itinerary?.segments ?? [];
  const hasItinerary = segments.length > 0;
  const hasBothPoints = Boolean(originProp && destinationProp);
  // Un seul point fourni (issue #111 - l'utilisateur n'a choisi que
  // l'origine ou que la destination sur l'ecran de recherche) : un marqueur,
  // pas de trace. Rien du tout (ni itineraire, ni un seul point, ni les
  // deux) : vue par defaut sur la metropole, voir RENNES_METROPOLE_CENTER -
  // la carte est desormais un fond permanent (#110), plus jamais absente.
  const singlePoint = !hasItinerary && !hasBothPoints
    ? (originProp ?? destinationProp)
    : undefined;

  const origin = hasItinerary
    ? segments[0].from
    : hasBothPoints
      ? (originProp as LatLon)
      : undefined;
  const destination = hasItinerary
    ? segments[segments.length - 1].to
    : hasBothPoints
      ? (destinationProp as LatLon)
      : undefined;
  // Points de correspondance = frontieres entre segments (le "from" de tout
  // segment sauf le premier, deja marque comme origine). Aucun sans
  // itineraire : rien entre une origine et une destination qui ne sont pas
  // encore reliees par un trajet.
  const transferPoints = hasItinerary
    ? segments.slice(1).map((segment) => segment.from)
    : [];

  // Vue par bounds (ajuste le zoom pour englober tous les points) quand on a
  // au moins 2 points a cadrer ; sinon un centre/zoom fixe (un seul point,
  // ou la vue par defaut sans rien).
  const bounds = hasItinerary
    ? L.latLngBounds(
        segments.flatMap((segment) =>
          segment.geometry.map(
            (point) => [point.lat, point.lon] as [number, number],
          ),
        ),
      )
    : hasBothPoints
      ? L.latLngBounds([
          [(origin as LatLon).lat, (origin as LatLon).lon],
          [(destination as LatLon).lat, (destination as LatLon).lon],
        ])
      : undefined;
  const fixedCenter = singlePoint ?? RENNES_METROPOLE_CENTER;

  // Legende : une entree par ligne distincte pour le transport en commun,
  // une entree par mode pour le reste (marche, velo...) - meme logique de
  // dedup que les badges de ligne (issue #129, section 8.5), dans l'ordre
  // de premiere apparition. Vide sans itineraire : rien a legender tant
  // qu'aucun mode n'est connu.
  const legendChips = hasItinerary ? tripModeChips(itinerary as TripItinerary) : [];

  const isFullBleed = variant === 'fullBleed';

  // MapContainer de react-leaflet n'applique bounds/center/zoom de facon
  // fiable qu'au montage. La carte reste montee en continu (une seule
  // instance Leaflet pour toute la duree de vie du composant) ; les
  // changements de cadrage ulterieurs sont appliques de facon imperative par
  // <MapViewController> ci-dessous (issue #23, remplace l'ancien remontage
  // complet du conteneur via une `key`, voir docs/audits/eco-conception.md
  // section 6). On extrait les coins du rectangle en scalaires : passes tels
  // quels a MapViewController, ils peuvent servir de dependances d'effet
  // stables (un objet L.LatLngBounds serait recree a chaque rendu).
  const sw = bounds?.getSouthWest();
  const ne = bounds?.getNorthEast();
  const fixedCenterTuple: [number, number] = [fixedCenter.lat, fixedCenter.lon];

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
        {...(bounds
          ? { bounds, boundsOptions: { padding: [24, 24] } }
          : {
              center: fixedCenterTuple,
              zoom: singlePoint ? SINGLE_POINT_ZOOM : DEFAULT_ZOOM,
            })}
        // Molette : desactivee en mode 'boxed' (comportement d'origine de
        // l'issue #8) pour ne pas capter le defilement de la page quand la
        // carte est un simple encart dans un flux normal ; activee en
        // 'fullBleed' (#36 v2) puisque la page elle-meme ne defile plus
        // (voir RecherchePageResults.css) - rien a proteger.
        scrollWheelZoom={isFullBleed}
        // Pincement a deux doigts : deja actif par defaut dans Leaflet,
        // rendu explicite ici pour que l'intention soit claire (zoom
        // tactile attendu sur mobile, #36 v2).
        touchZoom
        className="mapview-container"
        aria-hidden="true"
      >
        {/* Applique tout changement de cadrage sur l'instance deja montee
            (issue #23) - remplace l'ancien remontage complet du conteneur. */}
        <MapViewController
          swLat={sw?.lat}
          swLng={sw?.lng}
          neLat={ne?.lat}
          neLng={ne?.lng}
          centerLat={fixedCenter.lat}
          centerLon={fixedCenter.lon}
          zoom={singlePoint ? SINGLE_POINT_ZOOM : DEFAULT_ZOOM}
        />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          // Éco-conception (issue #23) : ne charge les tuiles qu'une fois le
          // pan/zoom terminé, pas à chaque frame intermédiaire - évite une
          // rafale de requêtes tuiles pendant un geste. (Le cache runtime du
          // service worker sert le reste depuis le disque, voir vite.config.ts.)
          updateWhenIdle
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
                // Couleur de ligne GTFS pour un transport en commun connu
                // (issue #129, section 8.5), repli sur la couleur du mode
                // sinon - voir segmentColor.ts.
                color: getSegmentColor(segment),
                weight: 4,
                dashArray: style.dashed ? '2 10' : undefined,
                lineCap: 'round',
              }}
            />
          );
        })}
        {/* interactive={false} + keyboard={false} sur tous les marqueurs
            (issue #20, audit WCAG) : Leaflet rend un marqueur cliquable
            (interactive, classe leaflet-interactive) ET focusable au clavier
            (keyboard, tabindex="0"/role="button") par defaut, meme sans
            gestionnaire de clic - or aucun marqueur ici n'a de comportement
            au clic, et le conteneur de la carte est deja aria-hidden (voir
            plus haut). Un marqueur focusable mais aria-hidden serait
            atteignable au Tab sans jamais etre annonce par un lecteur
            d'ecran (violation axe-core button-name/4.1.2) - ces deux options
            retirent le marqueur du parcours clavier plutot que de lui
            ajouter un libelle qui contredirait la carte etant deliberement
            decorative. */}
        {origin && (
          <Marker
            position={[origin.lat, origin.lon]}
            icon={ORIGIN_ICON}
            interactive={false}
            keyboard={false}
          />
        )}
        {destination && (
          <Marker
            position={[destination.lat, destination.lon]}
            icon={DESTINATION_ICON}
            interactive={false}
            keyboard={false}
          />
        )}
        {singlePoint && (
          <Marker
            position={[singlePoint.lat, singlePoint.lon]}
            // originProp fourni (destinationProp absent) -> c'est l'origine
            // qui manque de contrepartie, meme icone que le cas complet.
            icon={originProp ? ORIGIN_ICON : DESTINATION_ICON}
            interactive={false}
            keyboard={false}
          />
        )}
        {transferPoints.map((point, index) => (
          <Marker
            key={index}
            position={[point.lat, point.lon]}
            icon={TRANSFER_ICON}
            interactive={false}
            keyboard={false}
          />
        ))}
        {/* Stations/vehicules en libre-service (issue #13) - le badge de
            chaque marqueur porte deja le nombre de velos disponibles (voir
            sharedMobilityIcon), pas besoin d'infobulle supplementaire.
            interactive={false}/keyboard={false} : meme raisonnement que les
            marqueurs ci-dessus, la carte entiere reste decorative (voir la
            docstring de MapView, WCAG 1.1.1). */}
        {sharedMobilityStations.map((station) => (
          <Marker
            key={station.id}
            position={[station.lat, station.lon]}
            icon={sharedMobilityIcon(station)}
            interactive={false}
            keyboard={false}
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
            interactive={false}
            keyboard={false}
          />
        )}
      </MapContainer>

      {/* Sans itineraire (recherche en cours), rien a resumer/legender - le
          resume/la legende n'ont de sens qu'une fois un trajet connu. */}
      {!isFullBleed && hasItinerary && (
        <>
          <p className="mapview-summary">
            De {(origin as TripPlace).name} à {(destination as TripPlace).name} :{' '}
            {formatDuration((itinerary as TripItinerary).durationSeconds)},{' '}
            {formatTransfers((itinerary as TripItinerary).transfers).toLowerCase()}.
          </p>

          <ul className="mapview-legend">
            {legendChips.map((chip) => {
              // chipLabel (lib/tripModeChips.ts) est la seule source du
              // libelle affiche - meme fonction que modesLabel
              // (RecherchePageResults.tsx), pour ne pas dupliquer la regle
              // "mode + ligne, sauf repli sans ligne connue" (issue #129).
              const label = chipLabel(chip);
              const swatchColor =
                chip.kind === 'line'
                  ? (chip.color ?? getModeStyle(chip.mode).color)
                  : getModeStyle(chip.mode).color;
              const key = chip.kind === 'line' ? `${chip.mode}:${chip.label}` : chip.mode;
              return (
                <li key={key} className="mapview-legend-item">
                  <span
                    className="mapview-legend-swatch"
                    style={{ background: swatchColor }}
                    aria-hidden="true"
                  />
                  {label}
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
