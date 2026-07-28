import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../components/Alert';
import Button from '../components/Button';
import FormField from '../components/FormField';
import { ApiError } from '../lib/api';
import {
  TRANSPORT_MODES,
  createProfile,
  getMyProfile,
  updateProfile,
} from '../lib/profile';
import './ProfilPage.css';

type Feedback = { variant: 'success' | 'error'; message: string };

/**
 * Ecran de gestion du profil de mobilite (F1, issue #34).
 *
 * Charge le profil existant au montage (GET /profiles/me). S'il n'existe
 * pas encore (404), le formulaire reste vide et la sauvegarde cree le
 * profil (POST) plutot que de le mettre a jour (PATCH) - transparent pour
 * l'utilisateur, un seul bouton "Enregistrer" quel que soit le cas.
 *
 * Pas de champ "eviter les escaliers" : le GTFS/OSM utilise par
 * OpenTripPlanner ne descend pas a ce niveau de detail, ce serait une
 * preference non exploitable par le moteur de routage. Seules des
 * contraintes reellement actionnables sont proposees (accessibilite PMR
 * via le parametre OTP correspondant, distance de marche, correspondances).
 */
function ProfilPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [reducedMobility, setReducedMobility] = useState(false);
  const [maxWalkingDistance, setMaxWalkingDistance] = useState('');
  const [maxTransfers, setMaxTransfers] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const profile = await getMyProfile();
        if (cancelled) return;
        setProfileExists(true);
        setSelectedModes(profile.preferredTransportModes);
        setReducedMobility(profile.reducedMobility);
        setMaxWalkingDistance(
          profile.maxWalkingDistanceMeters != null
            ? String(profile.maxWalkingDistanceMeters)
            : '',
        );
        setMaxTransfers(
          profile.maxTransfers != null ? String(profile.maxTransfers) : '',
        );
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiError && error.statusCode === 404) {
          // Pas encore de profil : formulaire vide, la sauvegarde le creera.
          setProfileExists(false);
        } else if (error instanceof ApiError && error.statusCode === 401) {
          // authGet a deja nettoye les jetons invalides (voir lib/api.ts).
          navigate('/connexion');
        } else {
          setFeedback({
            variant: 'error',
            message: 'Impossible de charger le profil pour le moment.',
          });
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  function toggleMode(mode: string) {
    setSelectedModes((current) =>
      current.includes(mode)
        ? current.filter((m) => m !== mode)
        : [...current, mode],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    const payload = {
      preferredTransportModes: selectedModes,
      reducedMobility,
      ...(maxWalkingDistance !== ''
        ? { maxWalkingDistanceMeters: Number(maxWalkingDistance) }
        : {}),
      ...(maxTransfers !== '' ? { maxTransfers: Number(maxTransfers) } : {}),
    };

    try {
      if (profileExists) {
        await updateProfile(payload);
      } else {
        await createProfile(payload);
        setProfileExists(true);
      }
      setFeedback({ variant: 'success', message: 'Profil enregistré.' });
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Une erreur inattendue est survenue.';
      setFeedback({ variant: 'error', message });
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <section>
        <h1>Profil de mobilité</h1>
        <p>Chargement…</p>
      </section>
    );
  }

  return (
    <section className="profil-page">
      <h1>Profil de mobilité</h1>
      <p>
        Définissez vos préférences de transport et vos contraintes
        d'accessibilité pour obtenir des itinéraires adaptés.
      </p>

      {feedback && (
        <Alert
          variant={feedback.variant}
          title={feedback.variant === 'success' ? 'Enregistré' : 'Erreur'}
        >
          {feedback.message}
        </Alert>
      )}

      <form onSubmit={(event) => void handleSubmit(event)}>
        <fieldset className="profil-fieldset">
          <legend>Modes de transport préférés</legend>
          {TRANSPORT_MODES.map((mode) => (
            <label key={mode.value} className="profil-checkbox">
              <input
                type="checkbox"
                checked={selectedModes.includes(mode.value)}
                onChange={() => toggleMode(mode.value)}
              />
              {mode.label}
            </label>
          ))}
        </fieldset>

        <fieldset className="profil-fieldset">
          <legend>Accessibilité</legend>
          <label className="profil-checkbox">
            <input
              type="checkbox"
              checked={reducedMobility}
              onChange={(event) => setReducedMobility(event.target.checked)}
            />
            Mobilité réduite
          </label>
        </fieldset>

        <FormField
          id="max-walking-distance"
          label="Distance de marche maximale (mètres)"
          type="number"
          min={0}
          value={maxWalkingDistance}
          onChange={(event) => setMaxWalkingDistance(event.target.value)}
          helpText="Laisser vide pour ne pas limiter."
        />

        <FormField
          id="max-transfers"
          label="Nombre de correspondances maximum"
          type="number"
          min={0}
          value={maxTransfers}
          onChange={(event) => setMaxTransfers(event.target.value)}
          helpText="Laisser vide pour ne pas limiter."
        />

        <Button type="submit" disabled={isSaving} className="profil-submit">
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>
    </section>
  );
}

export default ProfilPage;
