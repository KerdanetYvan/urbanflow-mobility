import { startTransition, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import { ApiError } from '../../lib/api';
import { logout } from '../../lib/auth';
import { useAuth } from '../../lib/useAuth';
import {
  ACCESSIBILITY_PREFERENCES,
  TRANSPORT_MODES,
  createProfile,
  getMyProfile,
  updateProfile,
} from '../../lib/profile';
import './ProfilPage.css';

type Feedback = { variant: 'success' | 'error'; message: string };

/** Etape courante de l'onboarding (issue #106/#107) - voir ProfileOnboarding. */
type OnboardingStep = 1 | 2;

interface ProfileOnboardingProps {
  /** Appele une fois le profil cree (avec ou sans preference cochee) - navigue vers /recherche, voir ProfilPage. */
  onComplete: () => void;
}

/**
 * Sequence d'onboarding affichee a la place du formulaire vide quand
 * l'utilisateur n'a pas encore de profil (issue #106/#107,
 * docs/specs/onboarding-profil-redirection.md section 3) - remplace
 * l'ancien formulaire unique sans guidance par 2 etapes, une par groupe de
 * preferences deja existant (modes de transport, puis accessibilite),
 * chacune individuellement franchissable sans rien cocher ("Passer").
 *
 * Un seul appel reseau pour toute la sequence : createProfile() a l'etape 2
 * ("Passer" ou "Terminer"), exactement le meme qu'avant pour le formulaire
 * non-onboarding - aucune evolution de ProfileInput necessaire, les
 * preferences non cochees restent de simples tableaux vides.
 */
function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [selectedAccessibilityPreferences, setSelectedAccessibilityPreferences] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleMode(mode: string) {
    setSelectedModes((current) =>
      current.includes(mode)
        ? current.filter((m) => m !== mode)
        : [...current, mode],
    );
  }

  function toggleAccessibilityPreference(pref: string) {
    setSelectedAccessibilityPreferences((current) =>
      current.includes(pref)
        ? current.filter((p) => p !== pref)
        : [...current, pref],
    );
  }

  /**
   * Cree le profil et termine la sequence (issue #106/#107). Recoit les
   * valeurs explicitement plutot que de relire l'etat courant : "Passer"
   * sur l'etape 2 doit ignorer une eventuelle selection deja cochee sur
   * cette meme etape (repli explicite sur un tableau vide, voir son
   * gestionnaire ci-dessous), ce qu'une lecture directe de l'etat React ne
   * garantirait pas (mise a jour asynchrone).
   */
  async function finish(modes: string[], accessibilityPreferences: string[]) {
    setError(null);
    setIsSaving(true);
    try {
      await createProfile({
        preferredTransportModes: modes,
        accessibilityPreferences,
      });
      onComplete();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="onboarding">
      <p className="onboarding-step-indicator">Étape {step} sur 2</p>

      {error && (
        <Alert variant="error" title="Erreur">
          {error}
        </Alert>
      )}

      {step === 1 ? (
        <div className="onboarding-step">
          <h2>Modes de transport préférés</h2>
          <p>
            Quels modes de transport utilisez-vous le plus souvent ? Cela
            nous aide à classer vos itinéraires — vous pourrez changer cela
            à tout moment depuis votre profil.
          </p>
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
          <div className="onboarding-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setSelectedModes([]);
                setStep(2);
              }}
            >
              Passer
            </Button>
            <Button type="button" onClick={() => setStep(2)}>
              Continuer
            </Button>
          </div>
        </div>
      ) : (
        <div className="onboarding-step">
          <h2>Préférences d'accessibilité</h2>
          <p>
            Avez-vous des contraintes de déplacement à prendre en compte ?
            Ces préférences influencent le classement de vos itinéraires,
            jamais un trajet ne sera exclu sur cette seule base.
          </p>
          <fieldset className="profil-fieldset">
            <legend>Préférences d'accessibilité</legend>
            {ACCESSIBILITY_PREFERENCES.map((pref) => (
              <label key={pref.value} className="profil-checkbox">
                <input
                  type="checkbox"
                  checked={selectedAccessibilityPreferences.includes(pref.value)}
                  onChange={() => toggleAccessibilityPreference(pref.value)}
                />
                {pref.label}
              </label>
            ))}
          </fieldset>
          <div className="onboarding-actions">
            <button
              type="button"
              className="onboarding-previous"
              onClick={() => setStep(1)}
              disabled={isSaving}
            >
              ← Précédent
            </button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() => void finish(selectedModes, [])}
            >
              Passer
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void finish(selectedModes, selectedAccessibilityPreferences)}
            >
              {isSaving ? 'Enregistrement…' : 'Terminer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Ecran de gestion du profil de mobilite (F1, issue #34).
 *
 * Charge le profil existant au montage (GET /profiles/me). S'il n'existe
 * pas encore (404), affiche l'onboarding en plusieurs etapes
 * (ProfileOnboarding, issue #106/#107) plutot que le formulaire d'edition
 * ci-dessous - celui-ci reste reserve a un profil deja existant (modifier
 * des preferences deja definies).
 *
 * Preferences d'accessibilite (issue #69, apres le changement de modele
 * backend #68) : un groupe de checkboxes correspondant a l'enum
 * AccessibilityPreference (voir lib/profile.ts), pas de champ libre ni de
 * seuil numerique - chaque valeur cochee est une entree de ponderation pour
 * le futur service de scoring, pas une contrainte qui elimine des trajets.
 */
function ProfilPage() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [profileExists, setProfileExists] = useState(false);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [selectedAccessibilityPreferences, setSelectedAccessibilityPreferences] = useState<string[]>([]);
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
        setSelectedAccessibilityPreferences(profile.accessibilityPreferences);
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

  function toggleAccessibilityPreference(pref: string) {
    setSelectedAccessibilityPreferences((current) =>
      current.includes(pref)
        ? current.filter((p) => p !== pref)
        : [...current, pref],
    );
  }

  /**
   * Reserve a la branche "profil existant" (issue #106/#107) - la branche
   * "pas de profil" passe desormais par ProfileOnboarding et son propre
   * appel a createProfile(), plus par ce formulaire.
   */
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setIsSaving(true);

    try {
      await updateProfile({
        preferredTransportModes: selectedModes,
        accessibilityPreferences: selectedAccessibilityPreferences,
      });
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

  // Pas encore de profil : onboarding en plusieurs etapes (issue #106/#107)
  // plutot que le formulaire d'edition ci-dessous, qui suppose un profil
  // deja existant a modifier.
  if (!profileExists) {
    return (
      <section className="profil-page">
        <h1>Profil de mobilité</h1>
        <ProfileOnboarding onComplete={() => navigate('/recherche')} />
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
        {/* Cote a cote a partir de 768px (issue #73, spec 5.2) - voir
            .profil-fieldsets dans ProfilPage.css. */}
        <div className="profil-fieldsets">
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
            <legend>Préférences d'accessibilité</legend>
            {ACCESSIBILITY_PREFERENCES.map((pref) => (
              <label key={pref.value} className="profil-checkbox">
                <input
                  type="checkbox"
                  checked={selectedAccessibilityPreferences.includes(pref.value)}
                  onChange={() => toggleAccessibilityPreference(pref.value)}
                />
                {pref.label}
              </label>
            ))}
          </fieldset>
        </div>

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
