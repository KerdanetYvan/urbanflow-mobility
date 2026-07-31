import { startTransition, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { ApiError } from '../../lib/api';
import { logout } from '../../lib/auth';
import { useAuth } from '../../lib/useAuth';
import {
  TRANSPORT_MODES,
  createProfile,
  getMyProfile,
  updateProfile,
} from '../../lib/profile';
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
  const { setAuthenticated } = useAuth();
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
          // authGet a deja nettoye les jetons invalides (voir lib/api.ts) :
          // on resynchronise le contexte pour que la nav (voir AppLayout)
          // arrete immediatement de proposer Profil/Historique.
          setAuthenticated(false);
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
  }, [navigate, setAuthenticated]);

  /**
   * Deconnexion (issue #65) : renvoie vers la recherche plutot que vers
   * l'ecran de connexion - se deconnecter, c'est parfois vouloir faire une
   * recherche rapide sans que le compte connecte l'influence (preferences,
   * historique...), pas forcement vouloir se reconnecter dans la foulee.
   * /recherche reste utilisable sans compte (voir issue #64).
   *
   * startTransition() est indispensable ici, pas une precaution superflue :
   * react-router-dom v7 marque ses propres mises a jour de navigation via
   * React.startTransition (verifie dans ses sources), donc navigate() est
   * une mise a jour BASSE priorite. Sans l'envelopper ici, setAuthenticated
   * (mise a jour normale, haute priorite) s'applique et se rend AVANT que la
   * transition vers /recherche ne soit commise : RequireAuth (voir
   * components/RequireAuth.tsx), encore monte sur /profil a cet instant,
   * detecte alors la session invalidee (son garde durci, issue #65) et
   * declenche SA PROPRE navigation vers /connexion, qui ecrase celle
   * demandee ici (constate en session, reproduit par un test de regression
   * dans App.spec.tsx). Englober logout()/setAuthenticated() dans la MEME
   * transition que navigate() garantit qu'ils se commitent ensemble, une
   * fois la navigation vers /recherche deja effective - RequireAuth n'a
   * alors plus jamais l'occasion de se re-rendre sur /profil avec une
   * session invalide.
   */
  function handleLogout() {
    startTransition(() => {
      navigate('/recherche');
      logout();
      setAuthenticated(false);
    });
  }

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

      {/* Hors du <form> : ne doit pas pouvoir etre declenche par un Entree
          dans un champ du formulaire de profil (comportement par defaut
          d'un bouton submit a l'interieur d'un <form>). */}
      <div className="profil-account-actions">
        <Button
          type="button"
          variant="secondary"
          onClick={handleLogout}
          className="profil-logout"
        >
          Se déconnecter
        </Button>
      </div>
    </section>
  );
}

export default ProfilPage;
