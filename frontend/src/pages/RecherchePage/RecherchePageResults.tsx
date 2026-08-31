import { useEffect, useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import Badge from '../../components/Badge/Badge';
import LineBadge from '../../components/LineBadge/LineBadge';
import MapView from '../../components/MapView/MapView';
import { getModeStyle } from '../../components/MapView/modeStyles';
import Skeleton from '../../components/Skeleton/Skeleton';
import { getTripModeIcon } from '../../components/tripModeIcon';
import { toHexColor } from '../../lib/color';
import {
  formatDuration,
  formatTime,
  formatTransfers,
} from '../../lib/format';
import type { PlaceSuggestion } from '../../lib/places';
import { chipLabel, isLineMode, tripModeChips } from '../../lib/tripModeChips';
import type { TripFallback, TripItinerary } from '../../lib/trips';
import { useGeolocation, type GeolocationStatus } from '../../lib/useGeolocation';
import { computeItineraryBadges, type ItineraryBadges } from './itineraryBadges';
import './RecherchePageResults.css';

/**
 * Etats du bandeau mobile (v2 de #36, disposition "carte plein ecran +
 * panneau flottant", decidee en session le 2026-08-03) :
 * - collapsed : juste la poignee + un apercu du trajet selectionne, carte
 *   entierement visible.
 * - list : la liste complete des itineraires (ou le formulaire en vue
 *   Edition, voir isEditingSearch plus bas - issue #171/#172), carte
 *   partiellement visible.
 * - detail : le detail segment par segment du trajet selectionne, carte
 *   presque entierement masquee.
 * Non pertinent en desktop (voir RecherchePageResults.css) : liste et
 * detail y sont deux panneaux flottants toujours visibles simultanement.
 */
type SheetState = 'collapsed' | 'list' | 'detail';

/** Distance verticale minimale (px) pour qu'un geste tactile sur la
 * poignee du bandeau soit traite comme un glissement plutot qu'un tap. */
const SWIPE_THRESHOLD_PX = 40;

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
    return 'Géolocalisation refusée. Activez-la dans les réglages de votre navigateur pour voir votre position sur la carte.';
  }
  if (status === 'unsupported' || status === 'error') {
    return 'Votre position en temps réel est indisponible pour le moment.';
  }
  return undefined;
}

interface SearchContextProps {
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  onEditSearch: () => void;
}

/**
 * Contexte de la recherche ("De X à Y") + action d'edition. Depuis la
 * fusion des panneaux (issue #171/#172, docs/specs/
 * fusion-recherche-resultats.md), "Modifier la recherche" ne navigue plus
 * vers un autre ecran : onEditSearch bascule isEditingSearch a true chez
 * RecherchePage, qui rebascule ce meme panneau vers sa vue Edition, sans
 * perdre la liste/le detail affiches juste avant (voir plus bas).
 */
function SearchContext({ origin, destination, onEditSearch }: SearchContextProps) {
  return (
    <p className="resultats-context">
      De {origin.label} à {destination.label}
      {' · '}
      <button
        type="button"
        className="resultats-link-button"
        onClick={onEditSearch}
      >
        Modifier la recherche
      </button>
    </p>
  );
}

interface ItineraryCardProps {
  itinerary: TripItinerary;
  isSelected: boolean;
  onSelect: () => void;
  /** Badge qualitatif de scoring a afficher sur cette carte (issue #126/#169) - au plus un par carte, absent = aucun badge. Voir itineraryBadges.ts. */
  badge?: string;
}

/**
 * Carte-itineraire de la liste de resultats (section 3.1 de la spec) : toute
 * la carte est l'unite tactile/clavier (un unique <button>), pas seulement
 * un lien "Voir le detail" - un <button> natif donne le comportement clavier
 * (Tab, Entree, Espace) sans code supplementaire.
 *
 * Le score n'est jamais affiche (section 3.1) : aucune valeur chiffree ici.
 * La rangee de puces de mode peut neanmoins afficher un badge de ligne pour
 * un transport en commun (bus/tram/metro/train, issue #129, voir
 * tripModeChips.ts) - le numero de ligne n'est pas le score, juste une
 * information factuelle sur l'itineraire.
 */
function ItineraryCard({ itinerary, isSelected, onSelect, badge }: ItineraryCardProps) {
  const chips = tripModeChips(itinerary);
  // Texte cache, lu par les lecteurs d'ecran : les puces ci-dessous sont
  // `aria-hidden`, ce texte en est l'equivalent textuel (WCAG 1.1.1).
  // chipLabel (lib/tripModeChips.ts) est la seule source du libelle par
  // puce - meme fonction que la legende de MapView, pour ne pas dupliquer
  // la regle "mode + ligne, sauf repli sans ligne connue" (issue #129).
  const modesLabel = chips.map((chip) => chipLabel(chip)).join(', ');

  return (
    <button
      type="button"
      className={`resultats-card${isSelected ? ' is-selected' : ''}`}
      aria-current={isSelected || undefined}
      onClick={onSelect}
    >
      {badge && (
        <span className="resultats-card-badges">
          <Badge>{badge}</Badge>
        </span>
      )}
      <span className="resultats-visually-hidden">Modes : {modesLabel}.</span>
      <span className="resultats-card-modes" aria-hidden="true">
        {chips.map((chip) =>
          chip.kind === 'line' ? (
            <LineBadge
              key={`${chip.mode}:${chip.label}`}
              mode={chip.mode}
              label={chip.label}
              color={chip.color}
              textColor={chip.textColor}
            />
          ) : (
            <span key={chip.mode} className="resultats-card-mode-icon">
              {getTripModeIcon(chip.mode)}
            </span>
          ),
        )}
      </span>
      <span className="resultats-card-main">
        <span className="resultats-card-time">
          {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)}
        </span>
        <span className="resultats-card-duration">
          {formatDuration(itinerary.durationSeconds)}
        </span>
        {/* Les prochains passages d'un resultat regroupe (issue #127) ne
            s'affichent plus sur la carte compacte : deplaces dans le detail
            de l'itineraire selectionne (issue #173, voir ItinerarySegments)
            pour alleger la liste. */}
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
  onEditSearch: () => void;
  /** Message a afficher si la position en temps reel (issue #9) n'est pas disponible - voir geolocationMessage(). */
  geolocationMessage?: string;
  /** Badge qualitatif par index d'itineraire (issue #126/#169) - au plus un par carte, voir itineraryBadges.ts. */
  itineraryBadges: ItineraryBadges;
  /** Repli renvoye par GET /trips (issue #190) - `walk-only` : la liste ci-dessous est le trajet a pied de repli, annonce par un bandeau. */
  fallback?: TripFallback;
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
  onEditSearch,
  geolocationMessage,
  itineraryBadges,
  fallback,
}: ResultsListProps) {
  return (
    <>
      <SearchContext origin={origin} destination={destination} onEditSearch={onEditSearch} />
      {fallback?.kind === 'walk-only' && (
        // Repli a pied (issue #190) : la "liste" ci-dessous n'est pas un
        // resultat normal mais l'itineraire a pied propose faute de transport
        // en commun - on l'annonce explicitement plutot que de le laisser
        // passer pour un trajet multimodal ordinaire.
        <p className="resultats-fallback-note">
          Aucun trajet en transport en commun à cette heure. Voici l’itinéraire
          à pied&nbsp;: {formatDuration(itineraries[0].durationSeconds)}.
        </p>
      )}
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
              badge={itineraryBadges[index]}
            />
          </li>
        ))}
      </ul>
    </>
  );
}

interface EmptyResultsProps {
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  onEditSearch: () => void;
}

/**
 * État vide (aucun itinéraire, pas même à pied) rendu DANS le panneau
 * fusionné (issue #190) - la carte plein écran reste en fond avec les
 * marqueurs origine/destination, plus de page `.resultats-page` séparée.
 * Partagé entre le panneau desktop et le bandeau mobile, comme ResultsList.
 *
 * L'action de recours est le "Modifier la recherche" de `SearchContext`
 * ci-dessus (édition en place, décision #190) - pas de second bouton
 * redondant dans le message.
 */
function EmptyResults({ origin, destination, onEditSearch }: EmptyResultsProps) {
  return (
    <>
      <SearchContext
        origin={origin}
        destination={destination}
        onEditSearch={onEditSearch}
      />
      <div className="resultats-empty">
        <p>Aucun itinéraire trouvé pour ce trajet, même à pied.</p>
        <p>
          Essayez d’élargir la plage horaire, ou de modifier l’origine ou la
          destination.
        </p>
        {/* Emplacement prévu pour l'action "voir le prochain créneau
            disponible" (issue #91, tâche suivante) : elle viendra ici, dans
            la disposition d'état vide construite par #190. */}
      </div>
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
 * ecran (variant="fullBleed" de MapView, voir RecherchePageResults
 * ci-dessous) affiche deja le trace du trajet selectionne, une deuxieme
 * carte ici serait redondante (decision prise en session le 2026-08-03).
 */
function ItinerarySegments({ itinerary }: ItinerarySegmentsProps) {
  return (
    <>
      {itinerary.nextDepartures && itinerary.nextDepartures.length > 1 && (
        // Itineraires identiques regroupes sous ce resultat (issue #127) :
        // les prochains departs (au-dela du premier, deja visible dans le
        // resume/la carte) vivent ici depuis #173, plus sur la carte
        // compacte de la liste - pour l'alleger.
        <p className="resultats-detail-next-departures">
          Prochain passage à {formatTime(itinerary.nextDepartures[0])}, puis{' '}
          {itinerary.nextDepartures
            .slice(1)
            .map((departure) => formatTime(departure))
            .join(', ')}
        </p>
      )}
      <ol
        className="resultats-segments"
        aria-label="Détail du trajet sélectionné, segment par segment"
      >
        {itinerary.segments.map((segment, index) => (
          <li key={index} className="resultats-segment">
            <span className="resultats-segment-icon" aria-hidden="true">
              {isLineMode(segment.mode) ? (
                <LineBadge
                  mode={segment.mode}
                  label={segment.routeName ?? getModeStyle(segment.mode).label}
                  color={toHexColor(segment.routeColor)}
                  textColor={toHexColor(segment.routeTextColor)}
                />
              ) : (
                getTripModeIcon(segment.mode)
              )}
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
    </>
  );
}

/**
 * Resume compact d'un itineraire, affiche dans la poignee du bandeau mobile
 * quand il est replie ("collapsed") - pas un <button> (deja imbrique dans
 * celui de la poignee), juste du texte + icones decoratives.
 */
function CompactPreview({ itinerary }: { itinerary: TripItinerary }) {
  const chips = tripModeChips(itinerary);
  return (
    <span className="resultats-sheet-preview">
      <span className="resultats-sheet-preview-modes" aria-hidden="true">
        {chips.map((chip) =>
          chip.kind === 'line' ? (
            <LineBadge
              key={`${chip.mode}:${chip.label}`}
              mode={chip.mode}
              label={chip.label}
              color={chip.color}
              textColor={chip.textColor}
            />
          ) : (
            <span key={chip.mode}>{getTripModeIcon(chip.mode)}</span>
          ),
        )}
      </span>
      <span className="resultats-sheet-preview-time">
        {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)} ·{' '}
        {formatDuration(itinerary.durationSeconds)}
      </span>
    </span>
  );
}

interface EditPanelProps {
  sheetState: 'collapsed' | 'expanded';
  onToggle: () => void;
  onTouchStart: (event: TouchEvent<HTMLButtonElement>) => void;
  onTouchEnd: (event: TouchEvent<HTMLButtonElement>) => void;
  children: ReactNode;
}

/**
 * Panneau/bandeau de la vue Edition (issue #171/#172) : meme classe
 * (.recherche-panel-form, voir RecherchePageResults.css) et meme mecanique
 * a 2 etats que le formulaire du tout premier chargement
 * (RecherchePage.tsx, screen.kind === 'formulaire') - au lieu de dupliquer
 * cette poignee/ce conteneur ici avec un state local independant, l'etat
 * (sheetState) et les gestionnaires de glissement sont recus en props,
 * portes par RecherchePage (formSheetState) : un seul et meme bandeau,
 * qu'il s'agisse du premier chargement ou d'une edition en place.
 */
function EditPanel({ sheetState, onToggle, onTouchStart, onTouchEnd, children }: EditPanelProps) {
  return (
    <div className="recherche-panel-form" data-sheet-state={sheetState}>
      <button
        type="button"
        className="recherche-panel-form-handle"
        onClick={onToggle}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        aria-expanded={sheetState === 'expanded'}
      >
        <span className="resultats-sheet-handle-bar" aria-hidden="true" />
        {sheetState === 'collapsed' && (
          <span className="recherche-panel-form-handle-label">
            Modifier la recherche
          </span>
        )}
      </button>
      {children}
    </div>
  );
}

interface RecherchePageResultsProps {
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
  /** null = recherche en cours, reponse de GET /trips pas encore recue (issue #73, spec 2.4). */
  itineraries: TripItinerary[] | null;
  /**
   * Repli renvoye par GET /trips (issue #190). `walk-only` : `itineraries`
   * contient le trajet a pied propose faute de transport en commun, affiche
   * dans le panneau fusionne avec un bandeau explicatif. Absent avec
   * `itineraries` vide = etat vide "sec" (message generique).
   */
  fallback?: TripFallback;
  /** Bascule vers la vue Edition du panneau fusionne (issue #171/#172) - ne demonte plus cet ecran. */
  onEditSearch: () => void;
  /** Preferences d'accessibilite du profil connecte (issue #126), voir frontend/src/lib/profile.ts. Absent/vide = profil incomplet ou recherche anonyme (issue #64) - seul le badge "meilleur choix global" s'affiche alors. */
  accessibilityPreferences?: string[];
  /**
   * Vue Edition active (issue #171/#172, docs/specs/
   * fusion-recherche-resultats.md section 2) : remplace la liste/le detail
   * par le formulaire (renderEditForm) dans le MEME panneau, sans demonter
   * ce composant - selectedIndex/sheetState (liste/detail) ci-dessous
   * restent donc intacts au retour ("Annuler").
   */
  isEditingSearch?: boolean;
  /** Referme la vue Edition sans relancer de recherche (bouton "Annuler" du formulaire, ou touche Echap). */
  onCancelEdit?: () => void;
  /** Etat du bandeau/panneau d'edition (2 etats, voir EditPanel) - porte par RecherchePage (formSheetState), partage avec le formulaire du tout premier chargement. */
  editSheetState?: 'collapsed' | 'expanded';
  onEditSheetToggle?: () => void;
  onEditSheetTouchStart?: (event: TouchEvent<HTMLButtonElement>) => void;
  onEditSheetTouchEnd?: (event: TouchEvent<HTMLButtonElement>) => void;
  /** Contenu du formulaire (RecherchePage.tsx, renderRechercheForm) - fonction plutot que noeud direct : evite de construire deux fois le meme element React pour rien si jamais ce composant se re-rendait sans que isEditingSearch ne change. */
  renderEditForm?: () => ReactNode;
}

/**
 * Disposition "recherche en cours" / "resultats" de l'ecran de recherche
 * fusionne (F2, issues #36/#73). Recoit ses donnees en props, fournies par
 * RecherchePage (plus de lecture de useLocation().state - la fusion en un
 * seul ecran/une seule route elimine la classe de bug "rechargement de
 * /resultats perd le contexte", voir docs/specs/
 * refonte-visuelle-mobile-desktop.md section 2.1).
 *
 * Disposition "carte plein ecran" (v2, decidee en session le 2026-08-03,
 * rapprochee des applications de cartographie grand public type Google
 * Maps) : la carte du trajet selectionne (MapView, variant="fullBleed")
 * occupe tout l'ecran en fond, les resultats sont affiches par-dessus dans
 * des panneaux flottants - deux panneaux cote a cote en desktop (liste +
 * detail), un bandeau ("bottom sheet") a 3 etats en mobile (voir
 * SheetState). La navigation principale de l'application (AppLayout) reste
 * visible au-dessus en desktop, mais est volontairement recouverte par le
 * bandeau en mobile (ecran de tache immersif) - voir les z-index dans
 * AppLayout.css et RecherchePageResults.css.
 *
 * Vue Edition (issue #171/#172, docs/specs/fusion-recherche-resultats.md) :
 * quand isEditingSearch est vrai, les panneaux liste+detail (desktop) et le
 * bandeau resultats (mobile) laissent place a un unique panneau formulaire
 * (EditPanel, classe .recherche-panel-form partagee avec RecherchePage.tsx).
 * Ce composant (RecherchePageResults) reste lui-meme monte pendant toute
 * l'edition - selectedIndex/sheetState (donc l'itineraire selectionne et
 * l'etat liste/detail du bandeau mobile) sont conserves en memoire, "Annuler"
 * les retrouve donc sans re-appel a /trips. Le DOM de la liste/du detail
 * n'est en revanche pas conserve a l'identique (retire du rendu plutot que
 * seulement masque en CSS, pour eviter d'avoir a la fois la liste ET le
 * formulaire montes avec des id de champ potentiellement dupliques) : un
 * defilement en cours dans la liste ne survit donc pas a un aller-retour
 * Modifier/Annuler, seule la selection elle-meme (aria-current) survit.
 *
 * L'etat vide (aucun itineraire) et l'etat "recherche en cours" (itineraries
 * null) n'utilisent pas la disposition immersive plein ecran pour le
 * premier (pas de trajet a tracer), mais la reprennent en chargement pour
 * le second (carte avec origine/destination seules, voir MapView).
 *
 * Note de sequencement Sprint 2 / Sprint 3 (section 3.4 du spec #25) : cet
 * ecran n'a aucune dependance visuelle au service de scoring (#16) - la
 * liste est affichee dans l'ordre renvoye par le backend, quel que soit le
 * critere de tri utilise a ce moment-la.
 */
function RecherchePageResults({
  origin,
  destination,
  itineraries,
  fallback,
  onEditSearch,
  accessibilityPreferences,
  isEditingSearch = false,
  onCancelEdit,
  editSheetState = 'expanded',
  onEditSheetToggle,
  onEditSheetTouchStart,
  onEditSheetTouchEnd,
  renderEditForm,
}: RecherchePageResultsProps) {
  // Itineraire selectionne par defaut : le premier de la liste (deja en tete
  // du tri backend).
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Etat du bandeau mobile, ignore en desktop (voir RecherchePageResults.css)
  // - "list" par defaut : la liste des resultats est ce qu'on veut voir en
  // premier apres une recherche, ni trop replie (invisible), ni trop
  // deploye (masquerait la carte inutilement avant toute selection).
  const [sheetState, setSheetState] = useState<SheetState>('list');
  const touchStartY = useRef<number | null>(null);
  // Hook appele inconditionnellement (regle des Hooks React), avant les
  // retours anticipes ci-dessous. Activee des que la carte est sur le point
  // d'etre affichee (chargement ou resultats non vides) - pas de
  // sollicitation du capteur GPS pour l'etat vide, qui n'affiche pas de carte.
  const showsMap = itineraries === null || itineraries.length > 0;
  const geolocation = useGeolocation(showsMap);
  // Calcule une seule fois les badges qualitatifs (issue #126) - hook
  // appele inconditionnellement (regle des Hooks React), avant les retours
  // anticipes ci-dessous, meme si `itineraries` est encore null (auquel cas
  // il n'y a aucun badge a calculer). Transmis identique aux deux rendus de
  // ResultsList (panneau desktop et bandeau mobile) pour eviter de refaire
  // le calcul deux fois.
  const itineraryBadges = useMemo(
    () => computeItineraryBadges(itineraries ?? [], accessibilityPreferences ?? []),
    [itineraries, accessibilityPreferences],
  );

  // Touche Echap referme la vue Edition (issue #171/#172), meme motif que
  // TransportModesFilter (RecherchePage.tsx) - ecouteur pose uniquement
  // pendant l'edition, retire des qu'elle se referme.
  useEffect(() => {
    if (!isEditingSearch || !onCancelEdit) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancelEdit?.();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isEditingSearch, onCancelEdit]);

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

  /**
   * Panneau/bandeau d'edition (issue #171/#172) : rendu une seule fois (pas
   * une copie desktop + une copie mobile comme ResultsList/ItinerarySegments
   * ci-dessous) - EditPanel se repositionne lui-meme en bandeau bas ou en
   * panneau flottant haut-gauche via CSS (meme mecanique que le formulaire
   * du tout premier chargement). Dupliquer le formulaire cote a cote (comme
   * la liste) creerait des id de champ en double dans le DOM (AddressField
   * `id="origin-address"`, deja cible par document.getElementById dans
   * RecherchePage.tsx) - a eviter, contrairement a la liste/au detail qui
   * n'ont pas cette contrainte.
   */
  const editPanel =
    isEditingSearch && renderEditForm ? (
      <EditPanel
        sheetState={editSheetState}
        onToggle={onEditSheetToggle ?? (() => {})}
        onTouchStart={onEditSheetTouchStart ?? (() => {})}
        onTouchEnd={onEditSheetTouchEnd ?? (() => {})}
      >
        {renderEditForm()}
      </EditPanel>
    ) : null;

  // --- Recherche en cours (issue #73, spec 2.4) : aucun itineraire recu
  // pour l'instant, carte avec origine/destination seules + squelette. ---
  if (itineraries === null) {
    return (
      <div className="resultats-shell">
        <h1 className="resultats-visually-hidden">Résultats</h1>
        <div className="resultats-map-bg">
          <MapView
            origin={origin}
            destination={destination}
            variant="fullBleed"
            userPosition={geolocation.position}
          />
        </div>
        {editPanel ?? (
          <>
            <div className="resultats-panels">
              <div className="resultats-panel resultats-panel-list">
                <SearchContext origin={origin} destination={destination} onEditSearch={onEditSearch} />
                <Skeleton count={3} />
              </div>
            </div>
            <div className="resultats-sheet" data-sheet-state="list">
              <div className="resultats-sheet-handle">
                <span className="resultats-sheet-handle-bar" aria-hidden="true" />
              </div>
              <div className="resultats-sheet-body">
                <SearchContext origin={origin} destination={destination} onEditSearch={onEditSearch} />
                <Skeleton count={3} />
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // --- Etat vide (section 4 de la spec) : aucun itineraire trouve n'est pas
  // une erreur, pas d'Alert ici. Depuis #190, il est rendu DANS le panneau
  // fusionne (meme coquille que "recherche en cours" ci-dessus : carte plein
  // ecran en fond avec origine/destination, panneau desktop + bandeau mobile)
  // plutot que dans une page `.resultats-page` a part. "Modifier la recherche"
  // bascule en vue Edition en place (onEditSearch), coherent avec le reste du
  // panneau fusionne. Le repli a pied (fallback: 'walk-only') N'arrive PAS
  // ici : dans ce cas itineraries contient le trajet a pied, on passe donc au
  // rendu resultats normal ci-dessous (avec le bandeau explicatif de
  // ResultsList). ---
  if (itineraries.length === 0) {
    return (
      <div className="resultats-shell">
        <h1 className="resultats-visually-hidden">Résultats</h1>
        <div className="resultats-map-bg">
          <MapView
            origin={origin}
            destination={destination}
            variant="fullBleed"
            userPosition={geolocation.position}
          />
        </div>
        {editPanel ?? (
          <>
            <div className="resultats-panels">
              <div className="resultats-panel resultats-panel-list">
                <EmptyResults
                  origin={origin}
                  destination={destination}
                  onEditSearch={onEditSearch}
                />
              </div>
            </div>
            <div className="resultats-sheet" data-sheet-state="list">
              <div className="resultats-sheet-handle">
                <span
                  className="resultats-sheet-handle-bar"
                  aria-hidden="true"
                />
              </div>
              <div className="resultats-sheet-body">
                <EmptyResults
                  origin={origin}
                  destination={destination}
                  onEditSearch={onEditSearch}
                />
              </div>
            </div>
          </>
        )}
      </div>
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

      {editPanel ?? (
        <>
          {/* Panneaux flottants (desktop uniquement, voir la media query dans
              RecherchePageResults.css - masques en dessous de 768px). */}
          <div className="resultats-panels">
            <div className="resultats-panel resultats-panel-list">
              <ResultsList
                itineraries={itineraries}
                origin={origin}
                destination={destination}
                selectedIndex={selectedIndex}
                onSelect={selectItinerary}
                onEditSearch={onEditSearch}
                geolocationMessage={geolocationMessage(geolocation.status)}
                itineraryBadges={itineraryBadges}
                fallback={fallback}
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
                  onEditSearch={onEditSearch}
                  geolocationMessage={geolocationMessage(geolocation.status)}
                  itineraryBadges={itineraryBadges}
                />
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default RecherchePageResults;
