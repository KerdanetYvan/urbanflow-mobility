import { useMemo, useRef, useState, type ReactNode, type TouchEvent } from 'react';
import Alert from '../../components/Alert/Alert';
import Badge from '../../components/Badge/Badge';
import LineBadge from '../../components/LineBadge/LineBadge';
import MapView from '../../components/MapView/MapView';
import { getModeStyle } from '../../components/MapView/modeStyles';
import Skeleton from '../../components/Skeleton/Skeleton';
import { getTripModeIcon } from '../../components/tripModeIcon';
import TripFollowButton from '../../components/TripFollowButton/TripFollowButton';
import { toHexColor } from '../../lib/color';
import {
  formatDuration,
  formatNextDeparture,
  formatTime,
  formatTransfers,
} from '../../lib/format';
import type { PlaceSuggestion } from '../../lib/places';
import { chipLabel, isLineMode, tripModeChips } from '../../lib/tripModeChips';
import type { TripFallback, TripItinerary } from '../../lib/trips';
import { useGeolocation, type GeolocationStatus } from '../../lib/useGeolocation';
import { computeItineraryBadges, type ItineraryBadges } from './itineraryBadges';
import './RecherchePageResults.css';

/** Meme seuil que RecherchePage (poignee de .recherche-panel-form) - voir le commentaire associe la-bas. */
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
  selectedIndex: number;
  onSelect: (index: number) => void;
  /** Message a afficher si la position en temps reel (issue #9) n'est pas disponible - voir geolocationMessage(). */
  geolocationMessage?: string;
  /** Badge qualitatif par index d'itineraire (issue #126/#169) - au plus un par carte, voir itineraryBadges.ts. */
  itineraryBadges: ItineraryBadges;
  /** Repli renvoye par GET /trips (issue #190) - `walk-only` : la liste ci-dessous est le trajet a pied de repli, annonce par un bandeau. */
  fallback?: TripFallback;
  /** Resultats servis depuis le cache local, mode degrade (issue #10) - voir RecherchePageResultsProps#fromCache. */
  fromCache?: boolean;
}

/**
 * Liste des itineraires, affichee a la suite du formulaire de recherche
 * dans la meme carte persistante (issue #234) - plus de panneau ou de
 * bandeau separe pour la porter (l'ancienne disposition "carte plein ecran
 * + panneaux flottants" a ete abandonnee au profit d'une seule carte, voir
 * le commentaire de RecherchePageResults ci-dessous pour le detail).
 */
function ResultsList({
  itineraries,
  selectedIndex,
  onSelect,
  geolocationMessage,
  itineraryBadges,
  fallback,
  fromCache,
}: ResultsListProps) {
  return (
    <>
      {fromCache && (
        // Mode degrade (issue #10) : ces resultats viennent du cache local,
        // pas d'une reponse fraiche - horaires/perturbations potentiellement
        // perimes. Distinct du bandeau de repli ci-dessous (fallback), les
        // deux peuvent coexister (un trajet en cache peut lui-meme etre un
        // repli a pied/prochain creneau).
        <Alert variant="warning" title="Résultats hors ligne">
          Connexion indisponible - voici les résultats de votre dernière
          recherche pour ce trajet, potentiellement obsolètes.
        </Alert>
      )}
      {fallback && (
        // Bandeau de repli : la "liste" ci-dessous n'est pas un resultat
        // normal a l'heure demandee - on l'annonce explicitement.
        <p className="resultats-fallback-note">
          {fallback.kind === 'later-departure' ? (
            // Prochain creneau (issue #91) : aucun trajet a l'heure demandee,
            // les itineraires ci-dessous partent plus tard.
            <>
              Aucun trajet à {formatTime(fallback.requestedDepartureTime)}.
              Prochain trajet{' '}
              {formatNextDeparture(
                fallback.actualDepartureTime,
                fallback.requestedDepartureTime,
              )}
              .
            </>
          ) : (
            // Repli a pied (issue #190) : aucun trajet en transport en commun.
            <>
              Aucun trajet en transport en commun à cette heure. Voici
              l’itinéraire à pied&nbsp;:{' '}
              {formatDuration(itineraries[0].durationSeconds)}.
            </>
          )}
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

/**
 * État vide (aucun itinéraire, pas même à pied) rendu à la suite du
 * formulaire de recherche, dans la meme carte persistante (issue #190,
 * revu par #234).
 *
 * L'action de recours est directement les champs de recherche, juste
 * au-dessus (issue #234) - plus de bouton "Modifier la recherche" dédié
 * (`SearchContext`, retiré) : modifier l'origine, la destination ou l'heure
 * se fait sur place, sans action intermédiaire.
 *
 * Le repli "prochain créneau" (issue #91) et le repli à pied (#190) ne
 * passent PAS par ici : dans ces deux cas `itineraries` est non vide (le
 * trajet du repli), donc RecherchePageResults rend la liste normale avec un
 * bandeau explicatif (voir ResultsList / `.resultats-fallback-note`). Cet
 * état vide n'apparaît que lorsqu'il n'y a vraiment rien, même plus tard,
 * même à pied.
 */
function EmptyResults() {
  return (
    <div className="resultats-empty">
      <p>Aucun itinéraire trouvé pour ce trajet, même à pied.</p>
      <p>
        Essayez d’élargir la plage horaire, ou de modifier l’origine ou la
        destination.
      </p>
    </div>
  );
}

interface ItinerarySegmentsProps {
  itinerary: TripItinerary;
  /**
   * Libelles reellement recherches par l'utilisateur (issue #250) - servent
   * UNIQUEMENT a nommer l'extremite du tout premier/dernier segment (voir
   * plus bas), jamais les arrets de correspondance intermediaires (deja
   * correctement nommes par OTP). Memes props que RecherchePageResults
   * recoit deja de RecherchePage.tsx, simplement transmises un niveau plus
   * bas.
   */
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
}

/**
 * Detail de l'itineraire selectionne, segment par segment (mode, duree,
 * arret de correspondance) - section 3.2 de la spec. Ne contient plus sa
 * propre carte (contrairement a la v1 de #36) : la carte de fond plein
 * ecran (variant="fullBleed" de MapView, voir RecherchePageResults
 * ci-dessous) affiche deja le trace du trajet selectionne, une deuxieme
 * carte ici serait redondante (decision prise en session le 2026-08-03).
 */
function ItinerarySegments({ itinerary, origin, destination }: ItinerarySegmentsProps) {
  return (
    <>
      {itinerary.disrupted && (
        // Marqueur "Perturbation en cours" (issue #18,
        // docs/specs/f3-scoring-perturbations.md section 3.3) - cas a part
        // des badges qualitatifs (Badge, section 2.2 du meme spec) :
        // alerte de securite/actualite de trajet, visuellement distincte
        // (Alert, pas Badge), affichee independamment de leurs regles.
        <Alert variant="warning" title="Perturbation en cours">
          Ce trajet est actuellement touché par une perturbation - le
          classement des itinéraires en tient déjà compte.
        </Alert>
      )}
      <TripFollowButton itinerary={itinerary} />
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
        {itinerary.segments.map((segment, index) => {
          // Issue #250 : OTP nomme "Origin"/"Destination" (en anglais) le
          // point de depart/arrivee GLOBAL du trajet quand il ne correspond
          // a aucun arret/POI connu (une adresse geocodee, pas un arret de
          // transport) - jamais traduit, jamais remplace par le libelle
          // recherche par l'utilisateur avant cette issue. Ne concerne QUE
          // le premier "from" et le dernier "to" (l'origine/la destination
          // globales du trajet) : les arrets de correspondance
          // intermediaires sont deja correctement nommes par OTP (ce sont
          // de vrais arrets), on ne les touche pas.
          const isFirstSegment = index === 0;
          const isLastSegment = index === itinerary.segments.length - 1;
          const fromName = isFirstSegment ? origin.label : segment.from.name;
          const toName = isLastSegment ? destination.label : segment.to.name;

          return (
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
                  {fromName} → {toName}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </>
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
   * a la suite du formulaire avec un bandeau explicatif. Absent avec
   * `itineraries` vide = etat vide "sec" (message generique).
   */
  fallback?: TripFallback;
  /**
   * Ces resultats viennent du cache local, pas d'une reponse fraiche de
   * GET /trips (issue #10, "mode dégradé") - la recherche a echoue faute de
   * connexion, un trajet identique etait deja en cache
   * (frontend/src/lib/tripCache.ts). Annonce explicite, distincte du
   * bandeau de repli ci-dessus (fallback).
   */
  fromCache?: boolean;
  /** Preferences d'accessibilite du profil connecte (issue #126), voir frontend/src/lib/profile.ts. Absent/vide = profil incomplet ou recherche anonyme (issue #64) - seul le badge "meilleur choix global" s'affiche alors. */
  accessibilityPreferences?: string[];
  /**
   * Contenu du formulaire de recherche (RecherchePage.tsx,
   * renderRechercheForm), affiche en tete de la carte persistante
   * ci-dessous, avant les resultats (issue #234). Fonction plutot qu'un
   * noeud direct : evite de reconstruire l'element a chaque rendu de ce
   * composant pour rien.
   */
  renderSearchForm: () => ReactNode;
}

/**
 * Disposition "recherche en cours" / "resultats" de l'ecran de recherche
 * fusionne (F2, issues #36/#73). Recoit ses donnees en props, fournies par
 * RecherchePage (plus de lecture de useLocation().state - la fusion en un
 * seul ecran/une seule route elimine la classe de bug "rechargement de
 * /resultats perd le contexte", voir docs/specs/
 * refonte-visuelle-mobile-desktop.md section 2.1).
 *
 * Carte de recherche persistante (issue #234, revu deux fois apres retour
 * utilisateur en session - l'ancienne disposition "panneaux flottants
 * desktop + bandeau 3 etats mobile", qui affichait un second panneau EN
 * PLUS du formulaire, a ete abandonnee) : UNE SEULE carte flottante, celle
 * du formulaire de recherche (`.recherche-panel-form`, meme classe et meme
 * comportement que sur l'ecran "formulaire" du tout premier chargement,
 * RecherchePage.tsx) - la LISTE des itineraires vient s'ajouter A LA SUITE
 * du formulaire, sous le bouton "Rechercher", dans le meme corps defilant
 * (`.recherche-panel-form-body`, avec un espace visible entre le bouton et
 * la liste). Desktop et mobile partagent cette meme disposition pour le
 * formulaire + la liste (la carte se repositionne en panneau flottant
 * bas-gauche en desktop, reste un bandeau repliable en mobile - voir
 * RecherchePageResults.css, regles deja existantes pour
 * `.recherche-panel-form`) : plus de panneau "liste" separe, plus de
 * bandeau mobile a 3 etats (SheetState, CompactPreview - retires).
 *
 * Le DETAIL de l'itineraire selectionne fait exception (2e retour
 * utilisateur) : il ne rejoint PAS la carte de recherche en desktop - assez
 * de place pour l'afficher a cote, dans son propre panneau flottant
 * (`.resultats-detail-panel`) a DROITE de la carte, comme dans la toute
 * premiere version de cet ecran (issue #110/#111). En mobile, ou cette
 * place n'existe pas, il reste affiche a la suite de la liste, dans la
 * meme carte (`.resultats-detail`, classe partagee par les deux
 * emplacements pour le contenu, `--inline` ne changeant que sa visibilite
 * par breakpoint). Voir `detailContent` plus bas, construit une seule fois
 * et rendu aux deux emplacements - seule une media query CSS decide lequel
 * est visible a un instant donne (jamais les deux en meme temps a l'ecran).
 *
 * La carte de fond plein ecran (MapView, variant="fullBleed") reste
 * inchangee.
 *
 * `sheetState` ci-dessous ne pilote que le repli/deploiement mobile de
 * cette carte (2 etats, comme `formSheetState` de RecherchePage.tsx pour
 * l'ecran "formulaire" - jamais montes en meme temps, donc pas besoin de
 * partager cet etat entre les deux fichiers).
 *
 * L'etat vide (aucun itineraire) et l'etat "recherche en cours" (itineraries
 * null) reprennent la meme carte plein ecran (MapView avec origine/
 * destination seules pendant le chargement, voir MapView).
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
  fromCache,
  accessibilityPreferences,
  renderSearchForm,
}: RecherchePageResultsProps) {
  // Itineraire selectionne par defaut : le premier de la liste (deja en tete
  // du tri backend).
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Repli/deploiement de la carte en mobile (ignore en desktop, voir
  // RecherchePageResults.css) - "expanded" par defaut : la carte est ce que
  // l'utilisateur regarde juste apres avoir lance une recherche. Meme
  // mecanique a 2 etats que formSheetState (RecherchePage.tsx), dupliquee
  // plutot que partagee (les deux ecrans ne sont jamais montes ensemble).
  const [sheetState, setSheetState] = useState<'collapsed' | 'expanded'>(
    'expanded',
  );
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
  // il n'y a aucun badge a calculer).
  const itineraryBadges = useMemo(
    () => computeItineraryBadges(itineraries ?? [], accessibilityPreferences ?? []),
    [itineraries, accessibilityPreferences],
  );

  function selectItinerary(index: number) {
    setSelectedIndex(index);
  }

  /**
   * Poignee tapee/cliquee : bascule simplement entre les 2 etats (meme
   * logique que RecherchePage.tsx, handleFormHandleClick).
   */
  function handleHandleClick() {
    setSheetState((current) =>
      current === 'collapsed' ? 'expanded' : 'collapsed',
    );
  }

  function handleHandleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    touchStartY.current = event.touches[0].clientY;
  }

  /**
   * Glissement simple sur la poignee (etats discrets, pas de suivi du doigt
   * en temps reel) : un seuil de distance suffit a distinguer un tap d'un
   * glissement. Meme logique que RecherchePage.tsx, handleFormHandleTouchEnd.
   */
  function handleHandleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    if (touchStartY.current === null) return;
    const delta = event.changedTouches[0].clientY - touchStartY.current;
    touchStartY.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return; // tap, pas un glissement : laisse le clic naturel gerer le cycle

    // Empeche le clic synthetique qui suivrait sur mobile (touchend puis
    // click) de re-appliquer une transition contradictoire.
    event.preventDefault();
    setSheetState(delta > 0 ? 'collapsed' : 'expanded');
  }

  // --- Contenu affiche a la suite du formulaire, dans le meme corps
  // defilant (issue #234) : squelette de chargement, message d'etat vide,
  // ou liste des itineraires. Le detail de l'itineraire selectionne est
  // calcule a part (detailContent ci-dessous) : il ne vit PAS dans cette
  // meme carte en desktop (retour utilisateur en session) - voir plus bas. ---
  let listSection: ReactNode;
  let selectedItinerary: TripItinerary | null = null;
  if (itineraries === null) {
    // Recherche en cours (issue #73, spec 2.4) : aucun itineraire recu pour
    // l'instant.
    listSection = <Skeleton count={3} />;
  } else if (itineraries.length === 0) {
    // Etat vide (section 4 de la spec) : aucun itineraire trouve n'est pas
    // une erreur. Le repli a pied (fallback: 'walk-only') N'arrive PAS ici :
    // dans ce cas itineraries contient le trajet a pied, on passe donc par
    // la branche ci-dessous (avec le bandeau explicatif de ResultsList).
    listSection = <EmptyResults />;
  } else {
    selectedItinerary = itineraries[selectedIndex] as TripItinerary;
    listSection = (
      <ResultsList
        itineraries={itineraries}
        selectedIndex={selectedIndex}
        onSelect={selectItinerary}
        geolocationMessage={geolocationMessage(geolocation.status)}
        itineraryBadges={itineraryBadges}
        fallback={fallback}
        fromCache={fromCache}
      />
    );
  }

  // Detail de l'itineraire selectionne (issue #234, revu en session apres
  // retour utilisateur) : `null` tant qu'aucune liste n'est affichee.
  // Reutilise TEL QUEL a deux endroits differents ci-dessous - a l'interieur
  // de la carte de recherche en mobile (`.resultats-detail`, pas de place
  // pour un panneau separe) ET dans un panneau flottant independant a
  // DROITE de la carte en desktop (`.resultats-detail-panel`, assez de
  // place pour les montrer cote a cote) - seule une media query CSS decide
  // laquelle des deux copies est visible a un instant donne (voir
  // RecherchePageResults.css). Rendre le meme element deux fois est sans
  // risque ici : chaque emplacement est un parent totalement distinct dans
  // l'arbre, React y monte deux instances independantes.
  const detailContent = selectedItinerary && (
    <>
      <h2 className="resultats-detail-heading">
        Détail du trajet sélectionné
      </h2>
      <ItinerarySegments
        itinerary={selectedItinerary}
        origin={origin}
        destination={destination}
      />
    </>
  );

  return (
    <div className="resultats-shell">
      {/* Titre de page toujours present pour les lecteurs d'ecran - pas
          affiche visuellement, la disposition "carte plein ecran" ne laisse
          pas de place a un grand titre de page comme dans la v1 de cet
          ecran. */}
      <h1 className="resultats-visually-hidden">Résultats</h1>

      <div className="resultats-map-bg">
        {itineraries !== null && itineraries.length > 0 ? (
          <MapView
            itinerary={itineraries[selectedIndex]}
            variant="fullBleed"
            userPosition={geolocation.position}
          />
        ) : (
          <MapView
            origin={origin}
            destination={destination}
            variant="fullBleed"
            userPosition={geolocation.position}
          />
        )}
      </div>

      {/* Carte de recherche persistante (issue #234) : formulaire, puis
          resultats a sa suite - voir le commentaire de RecherchePageResults
          ci-dessus. Meme classes que l'ecran "formulaire" de RecherchePage
          (`.recherche-panel-form`), deja stylees pour les deux dispositions
          (bandeau repliable en mobile, panneau flottant en desktop). */}
      <div className="recherche-panel-form" data-sheet-state={sheetState}>
        <button
          type="button"
          className="recherche-panel-form-handle"
          onClick={handleHandleClick}
          onTouchStart={handleHandleTouchStart}
          onTouchEnd={handleHandleTouchEnd}
          aria-expanded={sheetState === 'expanded'}
        >
          <span className="resultats-sheet-handle-bar" aria-hidden="true" />
          {sheetState === 'collapsed' && (
            <span className="recherche-panel-form-handle-label">
              Rechercher un trajet
            </span>
          )}
        </button>

        <div className="recherche-panel-form-body">
          {renderSearchForm()}
          {/* Espace visible avec le bouton "Rechercher" au-dessus (retour
              utilisateur en session) : sans lui, la premiere carte-
              itineraire (ou le squelette/message d'etat vide) collait
              directement au bouton. */}
          <div className="recherche-panel-form-results">
            {listSection}
            {/* Detail EN PLUS de la liste, dans la meme carte : uniquement
                en mobile (pas de place pour un panneau separe) - masque a
                partir de 768px, voir RecherchePageResults.css. */}
            {detailContent && (
              <div className="resultats-detail resultats-detail--inline">
                {detailContent}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail de l'itineraire selectionne, a DROITE de la carte de
          recherche (issue #234, retour utilisateur en session) - desktop
          uniquement (masque par defaut, affiche a partir de 768px comme
          panneau flottant independant, voir RecherchePageResults.css). */}
      {detailContent && (
        <div className="resultats-detail-panel">{detailContent}</div>
      )}
    </div>
  );
}

export default RecherchePageResults;
