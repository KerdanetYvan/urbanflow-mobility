import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import AddressField, {
  type AddressQuickEntry,
} from '../../components/AddressField/AddressField';
import { useAddressSuggestions } from '../../components/AddressField/useAddressSuggestions';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { FunnelIcon, SwapIcon } from '../../components/icons';
import MapView from '../../components/MapView/MapView';
import { ApiError } from '../../lib/api';
import { getCurrentFollowedTrip } from '../../lib/followedTrip';
import { formatCoordinates } from '../../lib/format';
import { getMyProfile, TRANSPORT_MODES } from '../../lib/profile';
import type { PlaceSuggestion } from '../../lib/places';
import { getCachedTrip, saveTripToCache } from '../../lib/tripCache';
import {
  entryToPlaces,
  getTripHistory,
  searchTrips,
  type TripFallback,
  type TripHistoryEntry,
  type TripItinerary,
} from '../../lib/trips';
import { useAuth } from '../../lib/useAuth';
import { useGeolocation } from '../../lib/useGeolocation';
import RecherchePageResults from './RecherchePageResults';
import './RecherchePage.css';
// Classes .resultats-shell/.resultats-map-bg reutilisees telles quelles
// (issue #111) : deja pensees generiques par leur propre commentaire d'en-
// tete dans ce fichier, pas besoin de les dupliquer/renommer pour l'etat
// "formulaire". Depuis la fusion des panneaux (issue #171/#172, voir
// docs/specs/fusion-recherche-resultats.md), .recherche-panel-form vit
// aussi dans ce fichier - c'est desormais LE panneau du formulaire, que ce
// soit au tout premier chargement (ci-dessous) ou en edition en place
// depuis l'ecran resultats (RecherchePageResults.tsx).
import './RecherchePageResults.css';

/** Meme seuil que RecherchePageResults (poignee du bandeau resultats) - voir le commentaire associe la-bas. */
const SWIPE_THRESHOLD_PX = 40;

/**
 * Etat de l'ecran de recherche fusionne (issue #73, docs/specs/
 * refonte-visuelle-mobile-desktop.md section 2.2) : un seul ecran, une
 * seule route (/recherche), plutot que deux routes reliees par une
 * navigation avec etat React Router (ancien comportement, issue #35/#36).
 * Machine a etats a 3 valeurs : le formulaire (etat initial et retour
 * uniquement si aucune recherche n'a encore abouti - voir isEditingSearch
 * ci-dessous pour la modification d'une recherche existante), la recherche
 * en cours (reponse pas encore recue), les resultats (itineraires recus,
 * eventuellement une liste vide).
 */
type Screen =
  | { kind: 'formulaire' }
  | { kind: 'recherche'; origin: PlaceSuggestion; destination: PlaceSuggestion }
  | {
      kind: 'resultats';
      origin: PlaceSuggestion;
      destination: PlaceSuggestion;
      itineraries: TripItinerary[];
      /**
       * Repli renvoyé par GET /trips (issue #190) : présent quand aucun
       * trajet en transport en commun n'a été trouvé. `itineraries` contient
       * alors soit le trajet à pied de repli (`kind: 'walk-only'`), soit
       * rien du tout (état vide "sec", `fallback` absent).
       */
      fallback?: TripFallback;
      /**
       * Résultats servis depuis le cache local (issue #10, "mode dégradé")
       * plutôt que d'une réponse fraîche de GET /trips - la recherche a
       * échoué faute de connexion, mais un trajet identique était déjà en
       * cache (lib/tripCache.ts). RecherchePageResults l'annonce
       * explicitement, distinct du bandeau de repli ci-dessus (fallback).
       */
      fromCache?: boolean;
    };

/** Etat d'un champ origine/destination : le texte tape et, si l'utilisateur a choisi une suggestion, le lieu geocode correspondant. */
interface AddressFieldState {
  query: string;
  selected: PlaceSuggestion | null;
}

const EMPTY_ADDRESS: AddressFieldState = { query: '', selected: null };

interface AlertState {
  variant: 'error';
  message: string;
}

interface SearchFiltersModalProps {
  selectedModes: string[];
  onToggleMode: (mode: string) => void;
  departureTime: string;
  onDepartureTimeChange: (value: string) => void;
}

/** Selecteur simple, suffisant pour un focus trap - pas de dependance externe pour ca seul. */
const FOCUSABLE_SELECTOR =
  'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])';

/**
 * Modale de filtres de recherche (issue #233, lot 2) - point d'entree
 * unique pour tout filtre (modes de transport, heure de depart, et tout
 * futur filtre) - remplace l'ancien bouton dedie "Modes de transport"
 * (issue #108/#109, popover ancre) ET la divulgation "Plus d'options"
 * (issue #110/#111, qui ne contenait plus que l'heure de depart) :
 * fusionnes ici a la demande de l'utilisateur en session, pour ne plus
 * avoir deux points d'entree separes qui grossissent au fil des filtres
 * ajoutes.
 *
 * <div role="dialog" aria-modal="true"> avec piege de focus manuel plutot
 * que l'element <dialog> natif (showModal()/close()) : verifie en session
 * que jsdom 29 (environnement de test de ce projet, voir vite.config.ts)
 * n'implemente PAS HTMLDialogElement#showModal - l'utiliser aurait rendu
 * toute cette modale non testable. Le piege de focus/Echap/clic sur le
 * fond ci-dessous reprend et etend le motif deja utilise par l'ancien
 * popover TransportModesFilter (deja teste avec succes sous jsdom), avec
 * UNE difference deliberee : le clic sur le fond referme ET rend le focus
 * au declencheur (contrairement a l'ancien popover, qui faisait exception
 * pour un clic exterieur ayant deja porte le focus ailleurs) - une VRAIE
 * modale avec un fond opaque n'a pas d'autre cible de focus concurrente
 * derriere elle a respecter, comportement plus simple et coherent avec un
 * <dialog> natif standard.
 *
 * Application en direct (retour utilisateur en session) : chaque case
 * cochee/heure changee agit immediatement sur l'etat de RecherchePage,
 * rien a "Appliquer" - fermer la modale ne fait que la fermer.
 */
function SearchFiltersModal({
  selectedModes,
  onToggleMode,
  departureTime,
  onDepartureTimeChange,
}: SearchFiltersModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Nombre de filtres actifs (issue #233) : affiche en badge sur le bouton
  // declencheur, seul indice visuel qu'un filtre est deja regle sans
  // rouvrir la modale. Un mode = une unite, une heure de depart renseignee
  // = une unite de plus (peu importe laquelle).
  const activeCount = selectedModes.length + (departureTime ? 1 : 0);

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  // Focus le premier element focusable a l'ouverture, piege Tab/Shift+Tab a
  // l'interieur de la modale (WAI-ARIA APG, pattern "Dialog (Modal)") et
  // referme a Echap - ecouteur pose uniquement quand la modale est ouverte.
  useEffect(() => {
    if (!isOpen) return;

    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR,
    );
    focusable?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
        return;
      }
      if (event.key !== 'Tab' || !focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className="recherche-filters-trigger"
        aria-haspopup="dialog"
        aria-label={activeCount > 0 ? `Filtres (${activeCount})` : 'Filtres'}
        onClick={() => setIsOpen(true)}
      >
        <FunnelIcon />
        {activeCount > 0 && (
          <span className="recherche-filters-badge" aria-hidden="true">
            {activeCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          className="recherche-filters-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div
            ref={dialogRef}
            className="recherche-filters-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Filtres de recherche"
          >
            <fieldset className="recherche-fieldset">
              <legend>Modes de transport pour cette recherche</legend>
              {TRANSPORT_MODES.map((mode) => (
                <label key={mode.value} className="recherche-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedModes.includes(mode.value)}
                    onChange={() => onToggleMode(mode.value)}
                  />
                  {mode.label}
                </label>
              ))}
            </fieldset>

            <FormField
              id="departure-time"
              label="Partir à"
              type="datetime-local"
              value={departureTime}
              onChange={(event) => onDepartureTimeChange(event.target.value)}
              helpText="Laisser vide pour partir maintenant."
            />

            <Button
              type="button"
              variant="secondary"
              className="recherche-filters-close"
              onClick={close}
            >
              Fermer
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Nombre max d'adresses issues de l'historique proposées dans le dropdown
 * d'un champ (issue #166, docs/specs/fusion-autocomplete-raccourcis.md
 * section 3.1). 4 plutôt que 3 : depuis le retrait de la liste de trajets
 * récents (ancien RechercheQuickShortcuts, #112), ce dropdown est la seule
 * surface d'accès à l'historique sur /recherche.
 */
const MAX_RECENT_ADDRESSES = 4;

/**
 * Dérive une liste d'adresses individuelles récentes à partir de l'historique
 * de trajets (issue #166, spec section 3.2). `historyEntries` est une liste
 * de couples origine/destination dédupliqués et triés du plus récent au plus
 * ancien (GET /trips/history) ; on l'aplatit en adresses, plus récentes
 * d'abord.
 *
 * @param entries   historique tel que renvoyé par getTripHistory()
 * @param exclude   adresses à ne pas reproposer (domicile, travail, valeur
 *                  déjà choisie dans l'autre champ) - les `null` sont ignorés
 * @returns au plus MAX_RECENT_ADDRESSES `PlaceSuggestion`, dédupliquées par
 *          coordonnées (même clé que les `key` React des suggestions)
 */
function deriveRecentAddresses(
  entries: TripHistoryEntry[],
  exclude: (PlaceSuggestion | null)[],
): PlaceSuggestion[] {
  const placeKey = (place: PlaceSuggestion) => `${place.lat}-${place.lon}`;
  // Adresses déjà affichées ailleurs dans le même dropdown, ou incohérentes
  // à proposer (l'origine qu'on vient de choisir comme destination).
  const excluded = new Set(
    exclude
      .filter((place): place is PlaceSuggestion => place != null)
      .map(placeKey),
  );
  const seen = new Set<string>();
  const result: PlaceSuggestion[] = [];

  for (const entry of entries) {
    const { origin, destination } = entryToPlaces(entry);
    for (const place of [origin, destination]) {
      const key = placeKey(place);
      if (excluded.has(key) || seen.has(key)) continue;
      seen.add(key);
      result.push(place);
      if (result.length === MAX_RECENT_ADDRESSES) return result;
    }
  }

  return result;
}

/**
 * Ecran de recherche d'itineraire (F2, issue #35) - aussi la page d'accueil
 * de l'application ("/" redirige ici, voir App.tsx).
 *
 * Ecran fusionne avec l'ancien ResultatsPage/#36 (issue #73, docs/specs/
 * refonte-visuelle-mobile-desktop.md section 2) : une seule route
 * /recherche, machine a etats interne (voir le type Screen ci-dessus)
 * plutot que deux routes reliees par navigation avec etat React Router.
 * L'etat du formulaire (origine/destination/heure/modes) n'est JAMAIS
 * reinitialise entre les etats - c'est ce qui permet de le pre-remplir
 * gratuitement au retour depuis les resultats ("Modifier la recherche",
 * voir RecherchePageResults).
 *
 * Panneau formulaire fusionne avec le panneau resultats (issue #171/#172,
 * docs/specs/fusion-recherche-resultats.md) : "Modifier la recherche" ne
 * fait plus revenir a l'etat Screen "formulaire" (qui demonterait toute la
 * disposition resultats) - isEditingSearch bascule seulement le contenu du
 * MEME panneau (RecherchePageResults) vers la vue Edition, sans perdre la
 * liste ni la selection en cours. Screen reste "formulaire" uniquement pour
 * le tout premier chargement, avant la toute premiere recherche reussie.
 *
 * Utilisable sans compte (issue #64) : un usager de passage doit pouvoir
 * lancer une recherche sans etre bloque par un mur de connexion. Les modes
 * de transport preferes ne sont pre-remplis depuis le profil (F1) que si
 * l'utilisateur est connecte ; sinon le formulaire reste utilisable avec des
 * cases vides.
 *
 * Ecart volontaire par rapport a la spec (docs/specs/f2-ecrans-planification.md
 * section 2.1) : pas de toggle "Partir a" / "Arriver avant", seulement
 * "Partir a" - `SearchTripsDto` (backend, voir trips/dto/search-trips.dto.ts)
 * ne supporte pas encore `arriveBy`. Construire un toggle qui ne ferait rien
 * cote backend serait pire que ne pas l'afficher.
 */
function RecherchePage() {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>({ kind: 'formulaire' });
  // Bascule Edition/Resume du panneau fusionne (issue #171/#172) : n'a de
  // sens que lorsque screen.kind !== 'formulaire' (transmis a
  // RecherchePageResults ci-dessous) - au tout premier chargement, la vue
  // Edition est deja affichee via la branche formulaire, pas besoin de ce
  // drapeau.
  const [isEditingSearch, setIsEditingSearch] = useState(false);

  const [origin, setOrigin] = useState<AddressFieldState>(EMPTY_ADDRESS);
  const [destination, setDestination] =
    useState<AddressFieldState>(EMPTY_ADDRESS);
  const originSuggestions = useAddressSuggestions(
    origin.query,
    origin.selected?.label ?? null,
  );
  const destinationSuggestions = useAddressSuggestions(
    destination.query,
    destination.selected?.label ?? null,
  );

  const [departureTime, setDepartureTime] = useState('');
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  // Preferences d'accessibilite du profil connecte (issue #126) - transmises
  // telles quelles a RecherchePageResults pour le badge cible de scoring.
  // Tableau vide si non connecte ou profil incomplet (voir #64) : seul le
  // badge "meilleur choix global" s'affiche alors.
  const [accessibilityPreferences, setAccessibilityPreferences] = useState<
    string[]
  >([]);
  const [fieldErrors, setFieldErrors] = useState<{
    origin?: string;
    destination?: string;
  }>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  // Bandeau mobile du panneau formulaire (issue #110/#111, carte permanente)
  // - 2 etats seulement (contrairement au bandeau resultats a 3 etats,
  // RecherchePageResults) : "deplie" par defaut, le formulaire est ce que
  // l'utilisateur doit remplir en premier en arrivant sur l'ecran. Pilote a
  // la fois le formulaire du tout premier chargement (ci-dessous) et la vue
  // Edition en place depuis les resultats (transmis a RecherchePageResults).
  const [formSheetState, setFormSheetState] = useState<
    'collapsed' | 'expanded'
  >('expanded');
  const formTouchStartY = useRef<number | null>(null);
  // Historique des trajets (issue #112) - charge une seule fois au montage
  // (voir l'effet ci-dessous), aplati en adresses recentes pour le dropdown
  // des champs (issue #166, buildQuickEntries).
  const [historyEntries, setHistoryEntries] = useState<TripHistoryEntry[]>(
    [],
  );
  // Domicile/travail (issue #93/#113/#114) - derives du meme profil que
  // selectedModes/accessibilityPreferences ci-dessous, null tant que non
  // enregistres : buildQuickEntries omet alors simplement l'entree
  // correspondante du dropdown (issue #166).
  const [homeShortcut, setHomeShortcut] = useState<PlaceSuggestion | null>(
    null,
  );
  const [workShortcut, setWorkShortcut] = useState<PlaceSuggestion | null>(
    null,
  );
  // Entree de dropdown "Ma position actuelle" (issue #93/#166) - abonnement a
  // la demande (voir useGeolocation), jamais au chargement de la page : la
  // permission navigateur n'est sollicitee qu'a l'activation de l'entree
  // correspondante, pas avant.
  const [wantsPosition, setWantsPosition] = useState(false);
  const geolocation = useGeolocation(wantsPosition);
  const [positionError, setPositionError] = useState<string | undefined>(
    undefined,
  );

  // Pre-remplissage des modes preferes depuis le profil (F1), uniquement si
  // connecte. Echec silencieux (pas de profil, session expiree...) : la
  // recherche reste utilisable, modes vides plutot qu'un ecran bloque.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (!cancelled) {
          setSelectedModes(profile.preferredTransportModes);
          setAccessibilityPreferences(profile.accessibilityPreferences);
          // Domicile/travail (issue #93) : PlaceSuggestion derive du profil,
          // repli sur formatCoordinates si aucun libelle enregistre (voir
          // ProfilPage.tsx, meme motif).
          if (profile.homeLat != null && profile.homeLon != null) {
            setHomeShortcut({
              label:
                profile.homeLabel ??
                formatCoordinates(profile.homeLat, profile.homeLon),
              lat: profile.homeLat,
              lon: profile.homeLon,
            });
          }
          if (profile.workLat != null && profile.workLon != null) {
            setWorkShortcut({
              label:
                profile.workLabel ??
                formatCoordinates(profile.workLat, profile.workLon),
              lat: profile.workLat,
              lon: profile.workLon,
            });
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // Position GPS actuelle comme origine (issue #93) : une seule lecture, pas
  // un suivi continu (contrairement a RecherchePageResults, ou la carte
  // affiche la position en temps reel tant qu'elle est visible) - des
  // qu'une position est recue, on s'en sert et on se desabonne
  // (setWantsPosition(false)), pas besoin de continuer a solliciter le
  // capteur GPS pour un pre-remplissage ponctuel (eco-conception, CLAUDE.md).
  // setState differe via queueMicrotask (voir react-hooks/set-state-in-effect) :
  // meme motif que useAddressSuggestions.ts (setTimeout) - geolocation.status/
  // position sont deja de l'etat React (renvoye par useGeolocation), pas le
  // systeme externe brut ; l'appeler directement dans le corps synchrone de
  // cet effet declenche des rendus en cascade que la regle signale.
  useEffect(() => {
    if (!wantsPosition) return;
    const status = geolocation.status;
    const position = geolocation.position;
    queueMicrotask(() => {
      if (status === 'watching' && position) {
        const { lat, lon } = position;
        const label = 'Ma position actuelle';
        setOrigin({ query: label, selected: { label, lat, lon } });
        setPositionError(undefined);
        setWantsPosition(false);
      } else if (
        status === 'denied' ||
        status === 'unsupported' ||
        status === 'error'
      ) {
        setPositionError(
          status === 'denied'
            ? 'Géolocalisation refusée. Impossible d\'utiliser votre position comme origine.'
            : 'Votre position actuelle est indisponible pour le moment.',
        );
        setWantsPosition(false);
      }
    });
  }, [wantsPosition, geolocation.status, geolocation.position]);

  // Chargement des raccourcis de recherche rapide (issue #112), meme garde
  // et meme echec silencieux que le pre-remplissage des modes ci-dessus : un
  // utilisateur non connecte ou sans historique voit simplement le
  // formulaire sans raccourcis, jamais d'erreur bloquante.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getTripHistory()
      .then((entries) => {
        if (!cancelled) setHistoryEntries(entries);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  function toggleMode(mode: string) {
    setSelectedModes((current) =>
      current.includes(mode)
        ? current.filter((m) => m !== mode)
        : [...current, mode],
    );
  }

  /** Echange instantane origine/destination (section 2.1 - bouton "Inverser"). */
  function handleSwap() {
    setOrigin(destination);
    setDestination(origin);
  }

  /**
   * Affiche une erreur ET s'assure qu'elle reste visible (issue #111,
   * docs/specs/recherche-carte-permanente.md section 2) : si le bandeau
   * mobile est replie au moment de l'erreur, il se redeploie - l'utilisateur
   * ne doit jamais rater un message d'erreur parce que le bandeau etait en
   * position basse. Sans effet en desktop (pas de repli, voir RecherchePage.css).
   */
  function showError(message: string) {
    setAlert({ variant: 'error', message });
    setFormSheetState('expanded');
  }

  /** Poignee tapee/cliquee : bascule simplement entre les 2 etats (contrairement au bandeau resultats a 3 etats). */
  function handleFormHandleClick() {
    setFormSheetState((current) =>
      current === 'collapsed' ? 'expanded' : 'collapsed',
    );
  }

  function handleFormHandleTouchStart(event: TouchEvent<HTMLButtonElement>) {
    formTouchStartY.current = event.touches[0].clientY;
  }

  /** Meme logique de glissement que RecherchePageResults, simplifiee a 2 etats. */
  function handleFormHandleTouchEnd(event: TouchEvent<HTMLButtonElement>) {
    if (formTouchStartY.current === null) return;
    const delta = event.changedTouches[0].clientY - formTouchStartY.current;
    formTouchStartY.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;

    event.preventDefault();
    setFormSheetState(delta > 0 ? 'collapsed' : 'expanded');
  }

  /**
   * Effectue la recherche proprement dite une fois origine/destination
   * resolues (adresses valides et distinctes) : transition vers l'etat
   * "recherche" (issue #73), appel a searchTrips, puis vers "resultats" ou
   * retour au formulaire avec message d'erreur. Partagee par handleSubmit
   * (apres validation du formulaire) et handleQuickSearch (issue #112,
   * raccourcis de recherche rapide) qui n'a pas besoin de cette validation -
   * une entree d'historique est deja une recherche valide passee. Sort
   * aussi de la vue Edition (issue #171/#172) : une recherche - qu'elle
   * vienne d'une premiere soumission ou d'une modification en place -
   * affiche toujours la vue Resume + liste une fois terminee.
   */
  async function performSearch(
    originPlace: PlaceSuggestion,
    destinationPlace: PlaceSuggestion,
  ) {
    // Transition vers l'etat "recherche" (issue #73) : la disposition
    // resultats s'affiche immediatement, en chargement (carte
    // origine/destination sans trace + squelette, voir
    // RecherchePageResults) - remplace l'ancien bouton "Recherche…"/
    // isSearching, la page entiere devient l'indicateur de chargement.
    setScreen({ kind: 'recherche', origin: originPlace, destination: destinationPlace });
    setIsEditingSearch(false);

    try {
      const result = await searchTrips({
        originLat: originPlace.lat,
        originLon: originPlace.lon,
        destinationLat: destinationPlace.lat,
        destinationLon: destinationPlace.lon,
        // datetime-local n'a pas de fuseau : new Date() l'interprete en
        // heure locale du navigateur, ce qui correspond a l'intention de
        // l'utilisateur (voir MDN, chaine de date-heure sans offset).
        ...(departureTime
          ? { departureTime: new Date(departureTime).toISOString() }
          : {}),
        // Libelles d'adresse (issue #11) : envoyes uniquement si connecte -
        // seule une recherche authentifiee est historisee cote backend
        // (TripsService#search -> TripHistoryService#record), inutile
        // sinon.
        ...(isAuthenticated
          ? {
              originLabel: originPlace.label,
              destinationLabel: destinationPlace.label,
            }
          : {}),
        // Modes de transport preferes (issue #87) : transmis seulement si au
        // moins une case est cochee. Liste vide = filtre absent, le backend
        // considere alors tous les modes (docs/specs/filtre-modes-transport.md
        // section 6).
        ...(selectedModes.length > 0 ? { transportModes: selectedModes } : {}),
      });

      setScreen({
        kind: 'resultats',
        origin: originPlace,
        destination: destinationPlace,
        itineraries: result.itineraries,
        // Repli a pied eventuel (issue #190) - transmis a RecherchePageResults
        // pour l'afficher comme suggestion explicite plutot qu'un etat vide.
        fallback: result.fallback,
      });
      // Mode degrade (issue #10) : une recherche reussie alimente le cache
      // local, consulte plus bas si une future recherche echoue faute de
      // connexion. Apres setScreen (jamais avant) : le cache est un
      // sous-produit de l'affichage reussi, pas une condition dessus.
      saveTripToCache(originPlace, destinationPlace, result);
    } catch (error) {
      // Mode degrade (issue #10) : error instanceof ApiError signifie que
      // le backend a bien ete joint (et a repondu une erreur metier) - un
      // repli sur le cache n'aurait alors aucun sens, la connexion n'est
      // pas en cause. Dans le cas contraire (fetch n'a pas pu joindre le
      // backend), on cherche un trajet en cache pour ce meme couple
      // origine/destination avant d'abandonner sur l'ecran formulaire.
      if (!(error instanceof ApiError)) {
        const cached = getCachedTrip(originPlace, destinationPlace);
        if (cached) {
          setScreen({
            kind: 'resultats',
            origin: originPlace,
            destination: destinationPlace,
            itineraries: cached.result.itineraries,
            fallback: cached.result.fallback,
            fromCache: true,
          });
          return;
        }
      }

      const message =
        error instanceof ApiError
          ? error.message
          : 'Connexion indisponible, réessayez.';
      // Retour au formulaire (pas de route a quitter, juste un changement
      // d'etat) - les valeurs saisies restent intactes, rien n'est perdu.
      // Ecart volontaire : un echec repart sur l'ecran formulaire "plein"
      // plutot que de rester en vue Edition sur l'ancien ecran resultats -
      // il n'y a alors plus de resultats valides a resumer en dessous.
      setScreen({ kind: 'formulaire' });
      showError(message);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlert(null);
    setFieldErrors({});

    const errors: { origin?: string; destination?: string } = {};
    if (!origin.query.trim()) errors.origin = 'Ce champ est requis.';
    if (!destination.query.trim())
      errors.destination = 'Ce champ est requis.';

    if (errors.origin || errors.destination) {
      setFieldErrors(errors);
      setFormSheetState('expanded');
      document
        .getElementById(errors.origin ? 'origin-address' : 'destination-address')
        ?.focus();
      return;
    }

    // Adresse tapee mais jamais choisie dans la liste d'autocompletion :
    // traitee comme non resolue (section 2.3/4 de la spec), meme traitement
    // que si le geocodage avait echoue cote serveur.
    if (!origin.selected || !destination.selected) {
      showError(
        "Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.",
      );
      return;
    }

    if (
      origin.selected.lat === destination.selected.lat &&
      origin.selected.lon === destination.selected.lon
    ) {
      showError("L'origine et la destination doivent être différentes.");
      return;
    }

    await performSearch(origin.selected, destination.selected);
  }

  /**
   * Relance une recherche à partir d'un couple origine/destination déjà
   * résolu, sans repasser par la validation de handleSubmit : met à jour les
   * champs affichés (cohérent avec "Modifier la recherche", voir
   * RecherchePageResults - l'utilisateur doit retrouver ces valeurs s'il
   * revient au formulaire) puis appelle directement performSearch. Utilisée
   * par la relance depuis l'écran /historique (issue #174, effet ci-dessous)
   * - c'était aussi le clic sur un raccourci de recherche rapide (issue #112)
   * avant que celui-ci ne soit retiré au profit du dropdown unifié (#166).
   */
  function handleQuickSearch(
    originPlace: PlaceSuggestion,
    destinationPlace: PlaceSuggestion,
  ) {
    setAlert(null);
    setFieldErrors({});
    setOrigin({ query: originPlace.label, selected: originPlace });
    setDestination({ query: destinationPlace.label, selected: destinationPlace });
    void performSearch(originPlace, destinationPlace);
  }

  // Relance automatique depuis l'ecran Historique complet (issue #174,
  // bouton "Relancer cette recherche" de HistoriquePage) : origine/
  // destination transmises via l'etat de navigation React Router plutot
  // qu'un parametre d'URL, coherent avec l'absence de route /resultats
  // dediee (voir le type Screen en tete de fichier). Meme relance que
  // handleQuickSearch (ci-dessus) - pas de logique dupliquee.
  // navigate(..., { replace: true, state: null }) nettoie l'etat aussitot
  // lu : sans ca, un retour arriere ou un rafraichissement de la page
  // relancerait la meme recherche en boucle. Declare apres handleQuickSearch
  // (et non avec les autres effets en tete de composant) pour que la
  // fonction soit lexicalement disponible - sinon react-hooks/immutability
  // signale un acces avant declaration. handleQuickSearch/navigate
  // volontairement absents des dependances (memes motifs qu'ailleurs dans ce
  // fichier) : fonctions recreees a chaque rendu, les inclure ferait tourner
  // cet effet a chaque rendu au lieu de seulement quand location.state change.
  useEffect(() => {
    const incoming = location.state as
      | { origin: PlaceSuggestion; destination: PlaceSuggestion }
      | null
      | undefined;
    if (!incoming?.origin || !incoming.destination) return;
    navigate(location.pathname, { replace: true, state: null });
    // handleQuickSearch enchaine plusieurs setState : differe via
    // queueMicrotask pour ne pas les executer dans le corps synchrone de
    // l'effet (meme motif que l'effet de geolocalisation plus haut, voir
    // react-hooks/set-state-in-effect).
    queueMicrotask(() =>
      handleQuickSearch(incoming.origin, incoming.destination),
    );
  }, [location.state]);

  // Reprise automatique d'un trajet suivi (issue #18) : au tap sur une
  // notification de perturbation, le service worker ouvre l'app sur
  // "/recherche" (voir public/push-sw.js) sans etat de navigation ni
  // parametre d'URL (aucune route /resultats dediee, meme contrainte que
  // #174 ci-dessus) - cet effet retrouve le suivi actif via GET
  // /trips/current et relance la meme recherche que
  // TripFollowButton#toStartFollowingTripInput, pour atterrir directement
  // sur l'ecran de resultats deja recalcule (docs/specs/
  // f3-scoring-perturbations.md section 3.3 : "jamais un retour a l'ecran
  // de recherche"). Pas de garde particuliere contre une double execution :
  // un visiteur non authentifie n'a jamais de suivi (issue #18, section 3
  // du spec de cadrage - suivi reserve aux comptes), getCurrentFollowedTrip
  // degrade silencieusement (voir sa docstring) plutot que d'exiger un
  // isAuthenticated ici.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getCurrentFollowedTrip().then((followedTrip) => {
      if (cancelled || !followedTrip) return;
      queueMicrotask(() =>
        handleQuickSearch(
          {
            label: followedTrip.originLabel ?? 'Origine',
            lat: followedTrip.originLat,
            lon: followedTrip.originLon,
          },
          {
            label: followedTrip.destinationLabel ?? 'Destination',
            lat: followedTrip.destinationLat,
            lon: followedTrip.destinationLon,
          },
        ),
      );
    });
    return () => {
      cancelled = true;
    };
    // handleQuickSearch volontairement absent des dependances - meme
    // raisonnement que l'effet #174 ci-dessus (fonction recreee a chaque
    // rendu, l'inclure ferait tourner cet effet a chaque rendu au lieu de
    // seulement au changement de isAuthenticated).
  }, [isAuthenticated]);

  /**
   * Construit les entrées rapides du dropdown d'un champ d'adresse (issue
   * #166, docs/specs/fusion-autocomplete-raccourcis.md) : position GPS,
   * domicile, travail, adresses récentes - dans cet ordre (spec section 3.1).
   *
   * @param field  'origin' ou 'destination' : la position n'est proposée que
   *               sur l'origine (aller "vers sa position actuelle" n'a pas de
   *               sens) ; le reste est proposé sur les deux champs.
   * @returns la liste passée telle quelle à `AddressField` (aucune logique
   *          métier côté composant - il ne fait que la rendre).
   */
  function buildQuickEntries(field: 'origin' | 'destination'): AddressQuickEntry[] {
    const entries: AddressQuickEntry[] = [];
    // Remplit le champ courant avec un lieu déjà résolu (domicile, travail,
    // adresse récente) - même effet qu'une sélection de suggestion géocodeur,
    // sans relancer la recherche.
    const fillField = (place: PlaceSuggestion) => {
      const setField = field === 'origin' ? setOrigin : setDestination;
      setField({ query: place.label, selected: place });
    };

    if (field === 'origin') {
      entries.push({
        key: 'current-position',
        title: 'Ma position actuelle',
        // Pendant l'acquisition GPS, l'entrée reste visible mais désactivée
        // (même comportement que l'ancien bouton chip `OriginShortcuts`).
        subtitle: wantsPosition ? 'Localisation…' : 'Votre position GPS',
        icon: 'pin',
        disabled: wantsPosition,
        onSelect: () => setWantsPosition(true),
      });
    }

    if (homeShortcut) {
      entries.push({
        key: 'home',
        title: 'Domicile',
        // homeShortcut.label vaut déjà `profile.homeLabel` ou, à défaut, les
        // coordonnées formatées (voir l'effet de chargement du profil).
        subtitle: homeShortcut.label,
        icon: 'pin',
        onSelect: () => fillField(homeShortcut),
      });
    }
    if (workShortcut) {
      entries.push({
        key: 'work',
        title: 'Travail',
        subtitle: workShortcut.label,
        icon: 'pin',
        onSelect: () => fillField(workShortcut),
      });
    }

    // Adresses récentes : on exclut celles déjà montrées comme domicile/
    // travail et la valeur choisie dans l'AUTRE champ (spec section 3.2).
    const otherSelected =
      field === 'origin' ? destination.selected : origin.selected;
    for (const place of deriveRecentAddresses(historyEntries, [
      homeShortcut,
      workShortcut,
      otherSelected,
    ])) {
      entries.push({
        key: `recent-${place.lat}-${place.lon}`,
        title: place.label,
        subtitle: 'Recherché récemment',
        icon: 'history',
        onSelect: () => fillField(place),
      });
    }

    return entries;
  }

  /**
   * Contenu du panneau formulaire (issue #171/#172) : factorise en une
   * seule fonction plutot que duplique, puisqu'il est desormais rendu a
   * deux endroits distincts - la branche "formulaire" ci-dessous (tout
   * premier chargement, screen.kind === 'formulaire') ET, via
   * renderEditForm passe a RecherchePageResults, la vue Edition en place
   * une fois des resultats obtenus. `showCancel` n'affiche le bouton
   * "Annuler" que dans ce second cas : revenir au formulaire "plein" n'a
   * rien a annuler (rien n'existait avant).
   */
  function renderRechercheForm(showCancel: boolean): ReactNode {
    return (
      <div className="recherche-panel-form-body">
        {!isAuthenticated && (
          <p className="recherche-guest-hint">
            <Link to="/connexion">Connectez-vous</Link> pour retrouver
            votre profil de mobilité et des trajets personnalisés.
          </p>
        )}

        {alert && (
          <Alert variant={alert.variant} title="Erreur">
            {alert.message}
          </Alert>
        )}

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="recherche-form"
        >
          {/* Disposition compacte (issue #233) : le bouton d'inversion
              n'occupe plus sa propre "ligne" entre les deux champs (ancien
              positionnement centre avec marge negative, voir git blame) -
              il devient une colonne pleine hauteur a gauche d'une colonne
              origine/destination empilee, qui recupere l'espace vertical
              que le bouton consommait seul. */}
          <div className="recherche-addresses">
            <button
              type="button"
              className="recherche-swap"
              onClick={handleSwap}
              aria-label="Inverser l'origine et la destination"
            >
              <SwapIcon />
            </button>

            <div className="recherche-addresses-fields">
              {/* Wrapper dedie (issue #233) : porte le separateur interne
                  avec la destination (border-bottom, voir CSS) - inclut
                  volontairement l'erreur de geolocalisation eventuelle, qui
                  reste ainsi rattachee visuellement au champ Origine. */}
              <div className="recherche-address-origin">
                <AddressField
                  id="origin-address"
                  label="Origine"
                  value={origin.query}
                  suggestions={originSuggestions}
                  error={fieldErrors.origin}
                  quickEntries={buildQuickEntries('origin')}
                  hideLabel
                  onChange={(value) =>
                    setOrigin({ query: value, selected: null })
                  }
                  onSelect={(place) =>
                    setOrigin({ query: place.label, selected: place })
                  }
                />

                {/* Erreur de géolocalisation (permission refusée, indisponible) :
                    sous le champ, hors du dropdown (issue #166, spec section 4) -
                    l'entrée "Ma position actuelle" du dropdown, elle, se referme
                    dès que la valeur du champ change ou que l'utilisateur clique
                    ailleurs. */}
                {positionError && (
                  <p className="recherche-position-error">{positionError}</p>
                )}
              </div>

              <AddressField
                id="destination-address"
                label="Destination"
                value={destination.query}
                suggestions={destinationSuggestions}
                error={fieldErrors.destination}
                quickEntries={buildQuickEntries('destination')}
                hideLabel
                onChange={(value) =>
                  setDestination({ query: value, selected: null })
                }
                onSelect={(place) =>
                  setDestination({ query: place.label, selected: place })
                }
              />
            </div>
          </div>

          {/* Ligne filtres + Rechercher (issue #233, lot 2) : meme disposition
              "cadre unique, cellules collees" que .recherche-addresses
              ci-dessus - bouton filtre (icone entonnoir, ~10-20% de la
              largeur) a gauche, "Rechercher" occupe le reste. Remplace
              l'ancien bouton dedie "Modes de transport" (issue #108/#109)
              ET la divulgation "Plus d'options" (issue #110/#111, qui ne
              contenait plus que l'heure de depart) - fusionnes dans
              SearchFiltersModal, point d'entree unique pour tout filtre
              (actuel et futur). */}
          <div className="recherche-search-row">
            <SearchFiltersModal
              selectedModes={selectedModes}
              onToggleMode={toggleMode}
              departureTime={departureTime}
              onDepartureTimeChange={setDepartureTime}
            />
            <Button type="submit" className="recherche-submit">
              Rechercher
            </Button>
          </div>

          {/* "Annuler" (issue #171/#172) : ne revient PAS a une recherche
              anterieure ni ne reinitialise les champs - referme simplement
              la vue Edition sur la liste/le resume deja affiches en
              dessous (isEditingSearch), sans reappeler /trips. N'a de sens
              que si des resultats existent deja - reste hors de la ligne
              filtres/Rechercher ci-dessus (toujours 2 cellules, jamais 3),
              cas conditionnel plutot que la norme (retour utilisateur en
              session, issue #233). */}
          {showCancel && (
            <Button
              type="button"
              variant="secondary"
              className="recherche-cancel"
              onClick={() => setIsEditingSearch(false)}
            >
              Annuler
            </Button>
          )}
        </form>
      </div>
    );
  }

  // Etats "recherche" (chargement) et "resultats" (issue #73) : delegue a
  // RecherchePageResults, qui reprend l'ancienne disposition de
  // ResultatsPage/#36 - voir le type Screen en tete de fichier. Le panneau
  // formulaire (isEditingSearch/renderEditForm) est transmis pour que
  // "Modifier la recherche" bascule en place plutot que de demonter tout
  // cet ecran (issue #171/#172).
  if (screen.kind !== 'formulaire') {
    return (
      <RecherchePageResults
        origin={screen.origin}
        destination={screen.destination}
        itineraries={screen.kind === 'resultats' ? screen.itineraries : null}
        fallback={screen.kind === 'resultats' ? screen.fallback : undefined}
        fromCache={screen.kind === 'resultats' ? screen.fromCache : undefined}
        onEditSearch={() => {
          setIsEditingSearch(true);
          setFormSheetState('expanded');
        }}
        accessibilityPreferences={accessibilityPreferences}
        isEditingSearch={isEditingSearch}
        onCancelEdit={() => setIsEditingSearch(false)}
        editSheetState={formSheetState}
        onEditSheetToggle={handleFormHandleClick}
        onEditSheetTouchStart={handleFormHandleTouchStart}
        onEditSheetTouchEnd={handleFormHandleTouchEnd}
        renderEditForm={() => renderRechercheForm(true)}
      />
    );
  }

  // Etat "formulaire" (issue #110/#111, carte permanente) : meme coquille
  // que RecherchePageResults (.resultats-shell/.resultats-map-bg, classes
  // reutilisees depuis RecherchePageResults.css - voir l'import en tete de
  // fichier), la carte devient le fond de cet ecran aussi, plus seulement
  // des etats "recherche"/"resultats". Origine/destination deja resolues
  // sont transmises a MapView au fur et a mesure qu'elles sont choisies
  // (voir MapView.tsx, vue par defaut/marqueur unique/paire de marqueurs).
  return (
    <div className="resultats-shell">
      <h1 className="recherche-visually-hidden">Recherche d'itinéraire</h1>

      <div className="resultats-map-bg">
        <MapView
          origin={origin.selected ?? undefined}
          destination={destination.selected ?? undefined}
          variant="fullBleed"
        />
      </div>

      <div
        className="recherche-panel-form"
        data-sheet-state={formSheetState}
      >
        <button
          type="button"
          className="recherche-panel-form-handle"
          onClick={handleFormHandleClick}
          onTouchStart={handleFormHandleTouchStart}
          onTouchEnd={handleFormHandleTouchEnd}
          aria-expanded={formSheetState === 'expanded'}
        >
          <span className="resultats-sheet-handle-bar" aria-hidden="true" />
          {formSheetState === 'collapsed' && (
            <span className="recherche-panel-form-handle-label">
              Rechercher un trajet
            </span>
          )}
        </button>

        {renderRechercheForm(false)}
      </div>
    </div>
  );
}

export default RecherchePage;
