import { useRef, useState, type TouchEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import MapView from '../../components/MapView/MapView';
import { getModeStyle } from '../../components/MapView/modeStyles';
import { getTripModeIcon } from '../../components/tripModeIcon';
import {
  formatDuration,
  formatTime,
  formatTransfers,
} from '../../lib/format';
import type { PlaceSuggestion } from '../../lib/places';
import type { TripItinerary } from '../../lib/trips';
import { useGeolocation, type GeolocationStatus } from '../../lib/useGeolocation';
import './ResultatsPage.css';

/**
 * Forme de l'etat de navigation transmis par RecherchePage (#35) au succes
 * d'une recherche - voir docs/specs/f2-ecrans-planification.md section 2.4.
 * Ecart volontaire par rapport a la spec stricte (qui prevoit de transmettre
 * les criteres de recherche) : #35 transmet directement les itineraires deja
 * recherches aupres de GET /trips, donc cet ecran n'appelle pas l'API
 * lui-meme - pas de logique de nouvel appel/retry a prevoir ici.
 */
interface ResultatsLocationState {
  itineraries: TripItinerary[];
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
}

/**
 * Etats du bandeau mobile (v2 de #36, disposition "carte plein ecran +
 * panneau flottant", decidee en session le 2026-08-03) :
 * - collapsed : juste la poignee + un apercu du trajet selectionne, carte
 *   entierement visible.
 * - list : la liste complete des itineraires, carte partiellement visible.
 * - detail : le detail segment par segment du trajet selectionne, carte
 *   presque entierement masquee.
 * Non pertinent en desktop (voir ResultatsPage.css) : liste et detail y
 * sont deux panneaux flottants toujours visibles simultanement.
 */
type SheetState = 'collapsed' | 'list' | 'detail';

/** Distance verticale minimale (px) pour qu'un geste tactile sur la
 * poignee du bandeau soit traite comme un glissement plutot qu'un tap. */
const SWIPE_THRESHOLD_PX = 40;

/**
 * Modes de transport uniques utilises par un itineraire, dans l'ordre de
 * premiere apparition des segments (meme logique que MapView#modesUsed).
 */
function modesUsedBy(itinerary: TripItinerary): string[] {
  return [...new Set(itinerary.segments.map((segment) => segment.mode))];
}

/**
 * Message affiche quand la position en temps reel (issue #9) n'est pas
 * disponible - `undefined` pour 'idle'/'watching' (rien a signaler). Gere
 * explicitement la permission refusee (critere d'acceptation dedie de #9),
 * regroupee avec les cas plus rares ('unsupported'/'error') sous un message
 * generique : le resultat cote utilisateur est le meme (pas de marqueur sur
 * la carte), pas besoin de details techniques.
 */
function geolocationMessage(status: GeolocationStatus): string | undefined {
  if (status === 'denied') {
    return 'Géolocalisation refusée — activez-la dans les réglages de votre navigateur pour voir votre position sur la carte.';
  }
  if (status === 'unsupported' || status === 'error') {
    return 'Votre position en temps réel est indisponible pour le moment.';
  }
  return undefined;
}

interface ItineraryCardProps {
  itinerary: TripItinerary;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Carte-itineraire de la liste de resultats (section 3.1 de la spec) : toute
 * la carte est l'unite tactile/clavier (un unique <button>), pas seulement
 * un lien "Voir le detail" - un <button> natif donne le comportement clavier
 * (Tab, Entree, Espace) sans code supplementaire.
 *
 * Le score n'est jamais affiche (section 3.1) : aucune valeur ni badge ici,
 * seule la position dans la liste (deja triee par le backend) le reflete.
 */
function ItineraryCard({ itinerary, isSelected, onSelect }: ItineraryCardProps) {
  const modes = modesUsedBy(itinerary);
  // Texte cache, lu par les lecteurs d'ecran : les icones de mode ci-dessous
  // sont `aria-hidden`, ce texte en est l'equivalent textuel (WCAG 1.1.1).
  const modesLabel = modes.map((mode) => getModeStyle(mode).label).join(', ');

  return (
    <button
      type="button"
      className={`resultats-card${isSelected ? ' is-selected' : ''}`}
      aria-current={isSelected || undefined}
      onClick={onSelect}
    >
      <span className="resultats-visually-hidden">Modes : {modesLabel}.</span>
      <span className="resultats-card-modes" aria-hidden="true">
        {modes.map((mode) => (
          <span key={mode} className="resultats-card-mode-icon">
            {getTripModeIcon(mode)}
          </span>
        ))}
      </span>
      <span className="resultats-card-main">
        <span className="resultats-card-time">
          {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)}
        </span>
        <span className="resultats-card-duration">
          {formatDuration(itinerary.durationSeconds)}
        </span>
      </span>
      <span className="resultats-card-transfers">
        {formatTransfers(itinerary.transfers)}
      </span>
      <span className="resultats-card-action" aria-hidden="true">
        Voir le détail
      </span>
    </button>
  );
}

interface ResultsListProps {
  itineraries: TripItinerary[];
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Message a afficher si la position en temps reel (issue #9) n'est pas disponible - voir geolocationMessage(). */
  geolocationMessage?: string;
}

/**
 * Contenu partage entre le panneau flottant "liste" (desktop) et l'etat
 * "list" du bandeau (mobile) - evite de dupliquer la logique de rendu de la
 * liste, seul le conteneur autour differe selon la disposition.
 */
function ResultsList({
  itineraries,
  origin,
  destination,
  selectedIndex,
  onSelect,
  geolocationMessage,
}: ResultsListProps) {
  return (
    <>
      <p className="resultats-context">
        De {origin.label} à {destination.label}
        {' — '}
        <Link to="/recherche">Modifier la recherche</Link>
      </p>
      {geolocationMessage && (
        <p className="resultats-geolocation-hint">{geolocationMessage}</p>
      )}
      <ul className="resultats-list">
        {itineraries.map((itinerary, index) => (
          <li key={index}>
            <ItineraryCard
              itinerary={itinerary}
              isSelected={index === selectedIndex}
              onSelect={() => onSelect(index)}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

interface ItinerarySegmentsProps {
  itinerary: TripItinerary;
}

/**
 * Detail de l'itineraire selectionne, segment par segment (mode, duree,
 * arret de correspondance) - section 3.2 de la spec. Ne contient plus sa
 * propre carte (contrairement a la v1 de #36) : la carte de fond plein
 * ecran (variant="fullBleed" de MapView, voir ResultatsPage ci-dessous)
 * affiche deja le trace du trajet selectionne, une deuxieme carte ici serait
 * redondante (decision prise en session le 2026-08-03).
 */
function ItinerarySegments({ itinerary }: ItinerarySegmentsProps) {
  return (
    <ol
      className="resultats-segments"
      aria-label="Détail du trajet sélectionné, segment par segment"
    >
      {itinerary.segments.map((segment, index) => (
        <li key={index} className="resultats-segment">
          <span className="resultats-segment-icon" aria-hidden="true">
            {getTripModeIcon(segment.mode)}
          </span>
          <span className="resultats-segment-body">
            <span className="resultats-segment-label">
              {getModeStyle(segment.mode).label}
              {segment.routeName ? ` ${segment.routeName}` : ''}
            </span>
            <span className="resultats-segment-time">
              {formatTime(segment.startTime)} – {formatTime(segment.endTime)}{' '}
              ({formatDuration(segment.durationSeconds)})
            </span>
            <span className="resultats-segment-stop">
              {segment.from.name} → {segment.to.name}
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * Resume compact d'un itineraire, affiche dans la poignee du bandeau mobile
 * quand il est replie ("collapsed") - pas un <button> (deja imbrique dans
 * celui de la poignee), juste du texte + icones decoratives.
 */
function CompactPreview({ itinerary }: { itinerary: TripItinerary }) {
  const modes = modesUsedBy(itinerary);
  return (
    <span className="resultats-sheet-preview">
      <span className="resultats-sheet-preview-modes" aria-hidden="true">
        {modes.map((mode) => (
          <span key={mode}>{getTripModeIcon(mode)}</span>
        ))}
      </span>
      <span className="resultats-sheet-preview-time">
        {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)} ·{' '}
        {formatDuration(itinerary.durationSeconds)}
      </span>
    </span>
  );
}

/**
 * Ecran de resultats d'itineraires classes (F2, issue #36). Recoit les
 * itineraires deja recherches via l'etat de navigation pousse par
 * RecherchePage (#35) - une navigation directe sur /resultats (rechargement
 * de page, URL tapee a la main) n'a donc pas de criteres a afficher : on
 * renvoie alors vers /recherche plutot que d'afficher un ecran vide sans
 * contexte.
 *
 * Disposition "carte plein ecran" (v2, decidee en session le 2026-08-03,
 * rapprochee des applications de cartographie grand public type Google
 * Maps) : la carte du trajet selectionne (MapView, variant="fullBleed")
 * occupe tout l'ecran en fond, les resultats sont affiches par-dessus dans
 * des panneaux flottants - deux panneaux cote a cote en desktop (liste +
 * detail), un bandeau ("bottom sheet") a 3 etats en mobile (voir
 * SheetState). La navigation principale de l'application (AppLayout) reste
 * visible au-dessus en desktop, mais est volontairement recouverte par le
 * bandeau en mobile (ecran de tache immersif, coherent avec le fait que
 * "Resultats" n'apparait deja pas dans la barre de nav principale, voir
 * AppLayout.tsx) - voir les z-index dans AppLayout.css et ResultatsPage.css.
 *
 * L'etat vide (aucun itineraire) n'utilise pas cette disposition immersive :
 * pas de trajet a tracer sur une carte, l'ecran reste un simple contenu en
 * flux normal (voir le retour anticipe ci-dessous).
 *
 * Note de sequencement (section 3.4 du spec #25) : cet ecran n'a aucune
 * dependance au service de scoring (#16, Sprint 3) - la liste est affichee
 * dans l'ordre renvoye par GET /trips, quel que soit le critere de tri
 * utilise cote backend a ce moment-la. Les badges qualitatifs decrits dans
 * docs/specs/f3-scoring-perturbations.md section 2.2 restent reportes a
 * l'implementation de #16 (decision du 2026-08-03) : les afficher des
 * maintenant, sur un tri encore naïf (duree OTP native), serait trompeur.
 */
function ResultatsPage() {
  const location = useLocation();
  const state = location.state as ResultatsLocationState | null;

  // Itineraire selectionne par defaut : le premier de la liste (deja en tete
  // du tri backend).
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Etat du bandeau mobile, ignore en desktop (voir ResultatsPage.css) -
  // "list" par defaut : la liste des resultats est ce qu'on veut voir en
  // premier apres une recherche, ni trop replie (invisible), ni trop
  // deploye (masquerait la carte inutilement avant toute selection).
  const [sheetState, setSheetState] = useState<SheetState>('list');
  const touchStartY = useRef<number | null>(null);
  // Hook appele inconditionnellement (regle des Hooks React), avant les
  // retours anticipes ci-dessous - `enabled` reflete simplement si une carte
  // avec un itineraire est sur le point d'etre affichee : pas de sollicitation
  // du capteur GPS pour l'etat vide ou l'absence de criteres de recherche.
  const hasItineraries = state !== null && state.itineraries.length > 0;
  const geolocation = useGeolocation(hasItineraries);

  if (!state) {
    return <Navigate to="/recherche" replace />;
  }

  const { itineraries, origin, destination } = state;

  function selectItinerary(index: number) {
    setSelectedIndex(index);
    // Sur mobile, choisir un trajet ouvre directement son detail plutot que
    // de laisser l'utilisateur remonter chercher une action separee.
    setSheetState('detail');
  }

  /**
   * Poignee tapee/cliquee : deploie la liste depuis "collapsed" (seule
   * direction possible depuis le niveau le plus bas), sinon replie d'un
   * niveau ("detail" -> "list" -> "collapsed").
   */
  function handleHandleClick() {
    setSheetState((current) => {
      if (current === 'collapsed') return 'list';
      if (current === 'detail') return 'list';
      return 'collapsed';
    });
  }

  function handleHandleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartY.current = event.touches[0].clientY;
  }

  /**
   * Glissement simple sur la poignee (etats discrets, pas de suivi du doigt
   * en temps reel - decision prise en session le 2026-08-03) : un seuil de
   * distance suffit a distinguer un tap d'un glissement, pas besoin de
   * suivre le geste image par image pour un projet a delai serre.
   */
  function handleHandleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    if (touchStartY.current === null) return;
    const delta = event.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return; // tap, pas un glissement : laisse le clic naturel gerer le cycle

    // Empeche le clic synthetique qui suivrait sur mobile (touchend puis
    // click) de re-appliquer une transition contradictoire.
    event.preventDefault();
    if (delta > 0) {
      // Glissement vers le bas : repli d'un niveau.
      setSheetState((current) => (current === 'detail' ? 'list' : 'collapsed'));
    } else {
      // Glissement vers le haut : ouverture d'un niveau (seulement utile
      // depuis "collapsed", sans effet sinon).
      setSheetState((current) => (current === 'collapsed' ? 'list' : current));
    }
  }

  if (itineraries.length === 0) {
    // Etat vide (section 4 de la spec) : aucun itineraire trouve n'est pas
    // une erreur, pas d'Alert ici - un message clair et une action de
    // recours suffisent. Pas de carte plein ecran : rien a y tracer.
    return (
      <section className="resultats-page">
        <h1>Résultats</h1>
        <p className="resultats-context">
          De {origin.label} à {destination.label}
          {' — '}
          <Link to="/recherche">Modifier la recherche</Link>
        </p>
        <div className="resultats-empty">
          <p>Aucun itinéraire trouvé pour ce trajet.</p>
          <p>
            Essayez d'élargir la plage horaire ou d'ajouter un mode de
            transport a la recherche.
          </p>
          <Link to="/recherche">Nouvelle recherche</Link>
        </div>
      </section>
    );
  }

  const selectedItinerary = itineraries[selectedIndex] as TripItinerary;

  return (
    <div className="resultats-shell">
      {/* Titre de page toujours present pour les lecteurs d'ecran (une
          seule instance, contrairement au reste ci-dessous qui differe
          entre desktop et mobile) - pas affiche visuellement, la
          disposition "carte plein ecran" ne laisse pas de place a un grand
          titre de page comme dans la v1 de cet ecran. */}
      <h1 className="resultats-visually-hidden">Résultats</h1>

      <div className="resultats-map-bg">
        <MapView
          itinerary={selectedItinerary}
          variant="fullBleed"
          userPosition={geolocation.position}
        />
      </div>

      {/* Panneaux flottants (desktop uniquement, voir la media query dans
          ResultatsPage.css - masques en dessous de 768px). */}
      <div className="resultats-panels">
        <div className="resultats-panel resultats-panel-list">
          <ResultsList
            itineraries={itineraries}
            origin={origin}
            destination={destination}
            selectedIndex={selectedIndex}
            onSelect={selectItinerary}
            geolocationMessage={geolocationMessage(geolocation.status)}
          />
        </div>
        <div className="resultats-panel resultats-panel-detail">
          <ItinerarySegments itinerary={selectedItinerary} />
        </div>
      </div>

      {/* Bandeau mobile a 3 etats (masque a partir de 768px). */}
      <div className="resultats-sheet" data-sheet-state={sheetState}>
        <button
          type="button"
          className="resultats-sheet-handle"
          onClick={handleHandleClick}
          onTouchStart={handleHandleTouchStart}
          onTouchEnd={handleHandleTouchEnd}
          aria-expanded={sheetState !== 'collapsed'}
        >
          <span className="resultats-sheet-handle-bar" aria-hidden="true" />
          {sheetState === 'collapsed' && (
            <CompactPreview itinerary={selectedItinerary} />
          )}
        </button>

        <div className="resultats-sheet-body">
          {sheetState === 'detail' ? (
            <div className="resultats-sheet-detail">
              <button
                type="button"
                className="resultats-sheet-back"
                onClick={() => setSheetState('list')}
              >
                ← Tous les trajets
              </button>
              <ItinerarySegments itinerary={selectedItinerary} />
            </div>
          ) : (
            <ResultsList
              itineraries={itineraries}
              origin={origin}
              destination={destination}
              selectedIndex={selectedIndex}
              onSelect={selectItinerary}
              geolocationMessage={geolocationMessage(geolocation.status)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default ResultatsPage;
