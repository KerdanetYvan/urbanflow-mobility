import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { MapPinIcon, SwapIcon } from '../../components/icons';
import { ApiError } from '../../lib/api';
import { getMyProfile, TRANSPORT_MODES } from '../../lib/profile';
import { searchPlaces, type PlaceSuggestion } from '../../lib/places';
import { searchTrips } from '../../lib/trips';
import { useAuth } from '../../lib/useAuth';
import './RecherchePage.css';

/** Etat d'un champ origine/destination : le texte tape et, si l'utilisateur a choisi une suggestion, le lieu geocode correspondant. */
interface AddressFieldState {
  query: string;
  selected: PlaceSuggestion | null;
}

const EMPTY_ADDRESS: AddressFieldState = { query: '', selected: null };

/**
 * Suggestions d'autocompletion pour un champ origine/destination (debounce
 * 300ms). Ne relance pas de recherche si le texte correspond deja au libelle
 * de la suggestion selectionnee (evite un aller-retour reseau inutile juste
 * apres un clic sur une suggestion).
 */
function useAddressSuggestions(
  query: string,
  selectedLabel: string | null,
): PlaceSuggestion[] {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const trimmed = query.trim();
  // "Resolu" = rien a chercher (texte trop court) ou texte deja egal au
  // libelle de la suggestion selectionnee : la liste doit disparaitre
  // immediatement dans ce cas, calcule au rendu plutot que par un setState
  // synchrone dans l'effet (voir react-hooks/set-state-in-effect).
  const isResolved = trimmed.length < 2 || trimmed === selectedLabel;

  useEffect(() => {
    if (isResolved) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchPlaces(trimmed)
        .then((results) => {
          if (!cancelled) setSuggestions(results);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmed, isResolved]);

  return isResolved ? [] : suggestions;
}

interface AddressFieldProps {
  id: string;
  label: string;
  value: string;
  suggestions: PlaceSuggestion[];
  error?: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
}

/**
 * Champ origine/destination avec autocompletion (issue #35, voir
 * docs/specs/f2-ecrans-planification.md section 2.1). Reutilise FormField
 * pour l'input lui-meme ; la liste de suggestions est une simple liste de
 * boutons (chacun deja focusable/activable au clavier nativement), pas un
 * pattern combobox ARIA complet - suffisant pour ce projet, coherent avec le
 * niveau d'effort d'accessibilite du reste de l'ecran.
 */
function AddressField({
  id,
  label,
  value,
  suggestions,
  error,
  onChange,
  onSelect,
}: AddressFieldProps) {
  return (
    <div className="recherche-address-field">
      <FormField
        id={id}
        label={label}
        icon={<MapPinIcon />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        autoComplete="off"
      />
      <div aria-live="polite" className="recherche-visually-hidden">
        {suggestions.length > 0
          ? `${suggestions.length} suggestion(s) disponible(s)`
          : ''}
      </div>
      {suggestions.length > 0 && (
        <ul className="recherche-suggestions">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.lat}-${suggestion.lon}`}>
              <button type="button" onClick={() => onSelect(suggestion)}>
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AlertState {
  variant: 'error';
  message: string;
}

/**
 * Ecran de recherche d'itineraire (F2, issue #35) - aussi la page d'accueil
 * de l'application ("/" redirige ici, voir App.tsx).
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
  const navigate = useNavigate();

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
  const [fieldErrors, setFieldErrors] = useState<{
    origin?: string;
    destination?: string;
  }>({});
  const [alert, setAlert] = useState<AlertState | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Pre-remplissage des modes preferes depuis le profil (F1), uniquement si
  // connecte. Echec silencieux (pas de profil, session expiree...) : la
  // recherche reste utilisable, modes vides plutot qu'un ecran bloque.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getMyProfile()
      .then((profile) => {
        if (!cancelled) setSelectedModes(profile.preferredTransportModes);
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
      document
        .getElementById(errors.origin ? 'origin-address' : 'destination-address')
        ?.focus();
      return;
    }

    // Adresse tapee mais jamais choisie dans la liste d'autocompletion :
    // traitee comme non resolue (section 2.3/4 de la spec), meme traitement
    // que si le geocodage avait echoue cote serveur.
    if (!origin.selected || !destination.selected) {
      setAlert({
        variant: 'error',
        message:
          "Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.",
      });
      return;
    }

    if (
      origin.selected.lat === destination.selected.lat &&
      origin.selected.lon === destination.selected.lon
    ) {
      setAlert({
        variant: 'error',
        message: "L'origine et la destination doivent être différentes.",
      });
      return;
    }

    setIsSearching(true);
    try {
      const itineraries = await searchTrips({
        originLat: origin.selected.lat,
        originLon: origin.selected.lon,
        destinationLat: destination.selected.lat,
        destinationLon: destination.selected.lon,
        // datetime-local n'a pas de fuseau : new Date() l'interprete en
        // heure locale du navigateur, ce qui correspond a l'intention de
        // l'utilisateur (voir MDN, chaine de date-heure sans offset).
        ...(departureTime
          ? { departureTime: new Date(departureTime).toISOString() }
          : {}),
      });

      // Criteres transmis via l'etat de navigation plutot qu'en query
      // params, pour ne pas exposer de coordonnees precises dans l'URL
      // (contrainte RGPD geolocalisation, voir section 2.4 de la spec).
      navigate('/resultats', {
        state: {
          itineraries,
          origin: origin.selected,
          destination: destination.selected,
        },
      });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Connexion indisponible, réessayez.';
      setAlert({ variant: 'error', message });
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <section className="recherche-page">
      <h1>Recherche d'itinéraire</h1>

      {!isAuthenticated && (
        <p className="recherche-guest-hint">
          <Link to="/connexion">Connectez-vous</Link> pour retrouver votre
          profil de mobilité et des trajets personnalisés.
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
            onChange={(value) => setOrigin({ query: value, selected: null })}
            onSelect={(place) => setOrigin({ query: place.label, selected: place })}
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

        <FormField
          id="departure-time"
          label="Partir à"
          type="datetime-local"
          value={departureTime}
          onChange={(event) => setDepartureTime(event.target.value)}
          helpText="Laisser vide pour partir maintenant."
        />

        <fieldset className="recherche-fieldset">
          <legend>Modes de transport pour cette recherche</legend>
          {TRANSPORT_MODES.map((mode) => (
            <label key={mode.value} className="recherche-checkbox">
              <input
                type="checkbox"
                checked={selectedModes.includes(mode.value)}
                onChange={() => toggleMode(mode.value)}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <Button type="submit" disabled={isSearching} className="recherche-submit">
          {isSearching ? 'Recherche…' : 'Rechercher'}
        </Button>
      </form>
    </section>
  );
}

export default RecherchePage;
