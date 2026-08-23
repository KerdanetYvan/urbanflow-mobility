import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type TouchEvent,
} from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import AddressField from '../../components/AddressField/AddressField';
import { useAddressSuggestions } from '../../components/AddressField/useAddressSuggestions';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { HistoryIcon, SwapIcon } from '../../components/icons';
import MapView from '../../components/MapView/MapView';
import { ApiError } from '../../lib/api';
import { formatCoordinates } from '../../lib/format';
import { getMyProfile, TRANSPORT_MODES } from '../../lib/profile';
import type { PlaceSuggestion } from '../../lib/places';
import {
  getTripHistory,
  searchTrips,
  type TripHistoryEntry,
  type TripItinerary,
} from '../../lib/trips';
import { useAuth } from '../../lib/useAuth';
import RecherchePageResults from './RecherchePageResults';
import './RecherchePage.css';
// Classes .resultats-shell/.resultats-map-bg reutilisees telles quelles
// (issue #111) : deja pensees generiques par leur propre commentaire d'en-
// tete dans ce fichier, pas besoin de les dupliquer/renommer pour l'etat
// "formulaire".
import './RecherchePageResults.css';

/** Meme seuil que RecherchePageResults (poignee du bandeau resultats) - voir le commentaire associe la-bas. */
const SWIPE_THRESHOLD_PX = 40;

/**
 * Etat de l'ecran de recherche fusionne (issue #73, docs/specs/
 * refonte-visuelle-mobile-desktop.md section 2.2) : un seul ecran, une
 * seule route (/recherche), plutot que deux routes reliees par une
 * navigation avec etat React Router (ancien comportement, issue #35/#36).
 * Machine a etats a 3 valeurs : le formulaire (etat initial et retour
 * depuis les 2 autres), la recherche en cours (reponse pas encore recue),
 * les resultats (itineraires recus, eventuellement une liste vide).
 */
type Screen =
  | { kind: 'formulaire' }
  | { kind: 'recherche'; origin: PlaceSuggestion; destination: PlaceSuggestion }
  | {
      kind: 'resultats';
      origin: PlaceSuggestion;
      destination: PlaceSuggestion;
      itineraries: TripItinerary[];
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

interface TransportModesFilterProps {
  selectedModes: string[];
  onToggleMode: (mode: string) => void;
}

/**
 * Filtre des modes de transport pour cette recherche (issue #108/#109, voir
 * docs/specs/filtre-modes-transport.md) - extrait de "Plus d'options" vers
 * un bouton dedie toujours visible (section 2 de la spec), qui ouvre un
 * panneau en popover ancre juste en dessous (section 3). Reprend le
 * fieldset/les cases a cocher existants tels quels (section 4) - seul le
 * conteneur change, la logique de selection (selectedModes/toggleMode)
 * reste portee par RecherchePage.
 */
function TransportModesFilter({
  selectedModes,
  onToggleMode,
}: TransportModesFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /**
   * Fermeture "deliberee" (Echap, bouton "Fermer") : rend le focus au
   * declencheur, comme demande par la spec section 3. Le clic exterieur
   * (voir l'ecouteur ci-dessous) ne passe PAS par cette fonction - un clic
   * en dehors a deja porte le focus sur sa propre cible (ex. le champ
   * Destination), le lui reprendre de force romprait ce que l'utilisateur
   * vient de faire ; seules Echap/"Fermer" n'ont pas de cible de focus
   * concurrente a respecter.
   */
  function closeAndRefocusTrigger() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  // Fermeture au clic exterieur et a la touche Echap (section 3 de la
  // spec) - ecouteurs poses uniquement quand le panneau est ouvert, retires
  // a la fermeture.
  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeAndRefocusTrigger();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="recherche-modes-filter" ref={containerRef}>
      <Button
        type="button"
        variant="secondary"
        ref={triggerRef}
        className="recherche-modes-trigger"
        aria-expanded={isOpen}
        aria-controls="recherche-modes-panel"
        onClick={() => setIsOpen((current) => !current)}
      >
        {selectedModes.length > 0
          ? `Modes de transport · ${selectedModes.length}`
          : 'Modes de transport'}
      </Button>

      {isOpen && (
        <div id="recherche-modes-panel" className="recherche-modes-panel">
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
          <Button
            type="button"
            variant="secondary"
            className="recherche-modes-close"
            onClick={closeAndRefocusTrigger}
          >
            Fermer
          </Button>
        </div>
      )}
    </div>
  );
}

/** Nombre max de raccourcis affiches - le backend en renvoie jusqu'a 10 (MAX_RECENT_ENTRIES, TripHistoryService#findRecent), on n'en montre qu'une partie pour ne pas allonger davantage le panneau/bandeau formulaire (issue #110/#111). */
const MAX_QUICK_SHORTCUTS = 5;

interface RechercheQuickShortcutsProps {
  entries: TripHistoryEntry[];
  onSelect: (origin: PlaceSuggestion, destination: PlaceSuggestion) => void;
}

/**
 * Raccourcis de recherche rapide (issue #112) : reprend les trajets recents
 * de l'utilisateur connecte (GET /trips/history, issue #11) sous forme de
 * boutons juste sous le formulaire. Un clic relance directement la
 * recherche (voir handleQuickSearch dans RecherchePage) sans repasser par la
 * validation manuelle du formulaire - une entree d'historique est deja une
 * recherche valide passee (origine/destination resolues).
 *
 * N'affiche rien tant qu'aucune entree n'est disponible (pas connecte,
 * historique vide, ou pas encore charge) - pas d'etat vide ici,
 * contrairement a l'ecran /historique complet (#11) : ce widget est une
 * commodite optionnelle, pas une destination en soi.
 */
function RechercheQuickShortcuts({
  entries,
  onSelect,
}: RechercheQuickShortcutsProps) {
  if (entries.length === 0) return null;

  return (
    <div className="recherche-quick-shortcuts">
      <p className="recherche-quick-shortcuts-title">Trajets récents</p>
      <ul className="recherche-quick-shortcuts-list">
        {entries.slice(0, MAX_QUICK_SHORTCUTS).map((entry) => {
          const originLabel =
            entry.originLabel ??
            formatCoordinates(entry.originLat, entry.originLon);
          const destinationLabel =
            entry.destinationLabel ??
            formatCoordinates(entry.destinationLat, entry.destinationLon);
          return (
            <li key={entry.id}>
              <button
                type="button"
                className="recherche-quick-shortcut"
                onClick={() =>
                  onSelect(
                    {
                      label: originLabel,
                      lat: entry.originLat,
                      lon: entry.originLon,
                    },
                    {
                      label: destinationLabel,
                      lat: entry.destinationLat,
                      lon: entry.destinationLon,
                    },
                  )
                }
              >
                <HistoryIcon />
                <span>
                  {originLabel} → {destinationLabel}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
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
  const [screen, setScreen] = useState<Screen>({ kind: 'formulaire' });

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
  // l'utilisateur doit remplir en premier en arrivant sur l'ecran.
  const [formSheetState, setFormSheetState] = useState<
    'collapsed' | 'expanded'
  >('expanded');
  const formTouchStartY = useRef<number | null>(null);
  // Raccourcis de recherche rapide (issue #112) - trajets recents charges
  // une seule fois au montage, voir l'effet ci-dessous.
  const [historyEntries, setHistoryEntries] = useState<TripHistoryEntry[]>(
    [],
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
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

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
   * une entree d'historique est deja une recherche valide passee.
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

    try {
      const itineraries = await searchTrips({
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
      });

      setScreen({
        kind: 'resultats',
        origin: originPlace,
        destination: destinationPlace,
        itineraries,
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Connexion indisponible, réessayez.';
      // Retour au formulaire (pas de route a quitter, juste un changement
      // d'etat) - les valeurs saisies restent intactes, rien n'est perdu.
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
   * Clic sur un raccourci de recherche rapide (issue #112) : met a jour les
   * champs origine/destination affiches (coherent avec "Modifier la
   * recherche", voir RecherchePageResults - l'utilisateur doit retrouver ces
   * valeurs s'il revient au formulaire) puis relance directement la
   * recherche, sans passer par la validation de handleSubmit.
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

  // Etats "recherche" (chargement) et "resultats" (issue #73) : delegue a
  // RecherchePageResults, qui reprend l'ancienne disposition de
  // ResultatsPage/#36 - voir le type Screen en tete de fichier.
  if (screen.kind !== 'formulaire') {
    return (
      <RecherchePageResults
        origin={screen.origin}
        destination={screen.destination}
        itineraries={screen.kind === 'resultats' ? screen.itineraries : null}
        onEditSearch={() => setScreen({ kind: 'formulaire' })}
        accessibilityPreferences={accessibilityPreferences}
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
            <div className="recherche-addresses">
              <AddressField
                id="origin-address"
                label="Origine"
                value={origin.query}
                suggestions={originSuggestions}
                error={fieldErrors.origin}
                onChange={(value) =>
                  setOrigin({ query: value, selected: null })
                }
                onSelect={(place) =>
                  setOrigin({ query: place.label, selected: place })
                }
              />

              <button
                type="button"
                className="recherche-swap"
                onClick={handleSwap}
                aria-label="Inverser l'origine et la destination"
              >
                <SwapIcon />
              </button>

              <AddressField
                id="destination-address"
                label="Destination"
                value={destination.query}
                suggestions={destinationSuggestions}
                error={fieldErrors.destination}
                onChange={(value) =>
                  setDestination({ query: value, selected: null })
                }
                onSelect={(place) =>
                  setDestination({ query: place.label, selected: place })
                }
              />
            </div>

            {/* Bouton dedie toujours visible (issue #108/#109, voir
                docs/specs/filtre-modes-transport.md section 2) - extrait de
                "Plus d'options" ci-dessous, qui ne conserve donc plus que la
                date/heure de depart. */}
            <TransportModesFilter
              selectedModes={selectedModes}
              onToggleMode={toggleMode}
            />

            {/* Champ secondaire replie par defaut (issue #110/#111) : deja
                optionnel aujourd'hui (heure vide = "maintenant"), reduit
                l'emprise verticale du panneau flottant/bandeau. <details>
                natif - pas de machinerie ARIA custom, le role/l'etat sont
                deja corrects nativement. */}
            <details className="recherche-more-options">
              <summary>Plus d'options</summary>

              <FormField
                id="departure-time"
                label="Partir à"
                type="datetime-local"
                value={departureTime}
                onChange={(event) => setDepartureTime(event.target.value)}
                helpText="Laisser vide pour partir maintenant."
              />
            </details>

            <Button type="submit" className="recherche-submit">
              Rechercher
            </Button>
          </form>

          {/* Sous les champs de recherche et le bouton "Rechercher" (issue
              #112) - hors du <form> : ne represente pas une soumission du
              formulaire mais une relance directe (voir handleQuickSearch). */}
          <RechercheQuickShortcuts
            entries={historyEntries}
            onSelect={handleQuickSearch}
          />
        </div>
      </div>
    </div>
  );
}

export default RecherchePage;
