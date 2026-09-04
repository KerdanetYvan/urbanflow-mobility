import { startTransition, useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import AddressField from '../../components/AddressField/AddressField';
import { useAddressSuggestions } from '../../components/AddressField/useAddressSuggestions';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { LockIcon, MinusIcon, MoonIcon, PlusIcon, SunIcon } from '../../components/icons';
import Skeleton from '../../components/Skeleton/Skeleton';
import Switch from '../../components/Switch/Switch';
import { ApiError } from '../../lib/api';
import { deleteAccount, logout } from '../../lib/auth';
import { formatCoordinates } from '../../lib/format';
import type { GlyphSizePreference } from '../../lib/glyphSize';
import { useGlyphSizePreference } from '../../lib/useGlyphSizePreference';
import type { PlaceSuggestion } from '../../lib/places';
import { useAuth } from '../../lib/useAuth';
import { useThemeSwitch } from '../../lib/useThemeSwitch';
import {
  ACCESSIBILITY_PREFERENCES,
  TRANSPORT_MODES,
  createProfile,
  getMyProfile,
  updateProfile,
} from '../../lib/profile';
import './ProfilPage.css';

/** Etat d'un champ domicile/travail (issue #113/#114) : meme forme que dans RecherchePage.tsx (issue #35). */
interface AddressFieldState {
  query: string;
  selected: PlaceSuggestion | null;
}

const EMPTY_ADDRESS: AddressFieldState = { query: '', selected: null };

type Feedback = { variant: 'success' | 'error'; message: string };

/** Etape courante de l'onboarding (issue #106/#107, etape 3 ajoutee #236) - voir ProfileOnboarding. */
type OnboardingStep = 1 | 2 | 3;

interface ProfileOnboardingProps {
  /** Appele une fois le profil cree (avec ou sans preference cochee) - navigue vers /recherche, voir ProfilPage. */
  onComplete: () => void;
}

/**
 * Sequence d'onboarding affichee a la place du formulaire vide quand
 * l'utilisateur n'a pas encore de profil (issue #106/#107,
 * docs/specs/onboarding-profil-redirection.md section 3) - remplace
 * l'ancien formulaire unique sans guidance par 3 etapes, une par groupe de
 * champs deja present dans le formulaire d'edition :
 *   1. Modes de transport preferes ;
 *   2. Preferences d'accessibilite ;
 *   3. Adresses domicile / travail (ajout issue #236 - l'onboarding sert a
 *      guider l'utilisateur sur TOUT ce que la page profil permet de
 *      renseigner ; il sautait jusqu'ici ces deux adresses).
 * Chaque etape est individuellement franchissable sans rien saisir
 * ("Passer") - aucun de ces champs n'est obligatoire dans le formulaire
 * d'edition non plus.
 *
 * Un seul appel reseau pour toute la sequence : createProfile() a l'etape 3
 * ("Passer" ou "Terminer"), avec le meme payload que le bouton "Enregistrer"
 * du formulaire non-onboarding (adresses omises si non resolues) - aucune
 * evolution de ProfileInput necessaire.
 */
function ProfileOnboarding({ onComplete }: ProfileOnboardingProps) {
  const [step, setStep] = useState<OnboardingStep>(1);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);
  const [selectedAccessibilityPreferences, setSelectedAccessibilityPreferences] = useState<string[]>([]);
  // Domicile/travail (issue #236) - memes etats et memes hooks de
  // suggestions que le formulaire d'edition ci-dessous (ProfilPage), un par
  // adresse.
  const [homeAddress, setHomeAddress] = useState<AddressFieldState>(EMPTY_ADDRESS);
  const [workAddress, setWorkAddress] = useState<AddressFieldState>(EMPTY_ADDRESS);
  const homeSuggestions = useAddressSuggestions(
    homeAddress.query,
    homeAddress.selected?.label ?? null,
  );
  const workSuggestions = useAddressSuggestions(
    workAddress.query,
    workAddress.selected?.label ?? null,
  );
  const [addressErrors, setAddressErrors] = useState<{
    home?: string;
    work?: string;
  }>({});
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
   * Cree le profil et termine la sequence (issue #106/#107, adresses #236).
   * Recoit toutes les valeurs explicitement plutot que de relire l'etat
   * courant : "Passer" sur l'etape 3 doit ignorer une adresse eventuellement
   * deja saisie sur cette meme etape (les gestionnaires passent alors
   * `null`), ce qu'une lecture directe de l'etat React ne garantirait pas
   * (mise a jour asynchrone). Les adresses non resolues sont omises du
   * payload, exactement comme le bouton "Enregistrer" du formulaire
   * d'edition (pas de semantique "effacer via null" cote backend, voir son
   * commentaire).
   */
  async function finish(
    modes: string[],
    accessibilityPreferences: string[],
    home: PlaceSuggestion | null,
    work: PlaceSuggestion | null,
  ) {
    setError(null);
    setIsSaving(true);
    try {
      await createProfile({
        preferredTransportModes: modes,
        accessibilityPreferences,
        ...(home
          ? { homeLabel: home.label, homeLat: home.lat, homeLon: home.lon }
          : {}),
        ...(work
          ? { workLabel: work.label, workLat: work.lat, workLon: work.lon }
          : {}),
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

  /**
   * "Terminer" de l'etape 3 : valide les adresses avant l'appel reseau.
   * Une adresse tapee mais jamais choisie dans la liste d'autocompletion
   * est traitee comme non resolue (meme regle que ProfilPage#handleSubmit et
   * RecherchePage) - on bloque et on affiche l'erreur sous le champ. Un
   * champ totalement vide n'est pas une erreur : il signifie "ne rien
   * enregistrer pour cette adresse".
   */
  function finishWithAddresses() {
    const errors: { home?: string; work?: string } = {};
    if (homeAddress.query.trim() && !homeAddress.selected) {
      errors.home =
        'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.';
    }
    if (workAddress.query.trim() && !workAddress.selected) {
      errors.work =
        'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.';
    }
    setAddressErrors(errors);
    if (errors.home || errors.work) return;
    void finish(
      selectedModes,
      selectedAccessibilityPreferences,
      homeAddress.selected,
      workAddress.selected,
    );
  }

  return (
    <div className="onboarding">
      <p className="onboarding-step-indicator">Étape {step} sur 3</p>

      {error && (
        <Alert variant="error" title="Erreur">
          {error}
        </Alert>
      )}

      {step === 1 && (
        <div className="onboarding-step">
          <h2>Modes de transport préférés</h2>
          <p>
            Quels modes de transport utilisez-vous le plus souvent ? Cela
            nous aide à classer vos itinéraires. Vous pourrez changer cela
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
      )}

      {step === 2 && (
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
              onClick={() => {
                setSelectedAccessibilityPreferences([]);
                setStep(3);
              }}
            >
              Passer
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => setStep(3)}>
              Continuer
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="onboarding-step">
          <h2>Domicile et travail</h2>
          <p>
            Renseignez votre domicile et votre lieu de travail pour les
            retrouver en un geste comme point de départ d'une recherche.
            Facultatif, modifiable à tout moment depuis votre profil.
          </p>
          <div className="profil-addresses-fields">
            <AddressField
              id="onboarding-home-address"
              label="Domicile"
              value={homeAddress.query}
              suggestions={homeSuggestions}
              error={addressErrors.home}
              onChange={(value) =>
                setHomeAddress({ query: value, selected: null })
              }
              onSelect={(place) =>
                setHomeAddress({ query: place.label, selected: place })
              }
            />
            <AddressField
              id="onboarding-work-address"
              label="Travail"
              value={workAddress.query}
              suggestions={workSuggestions}
              error={addressErrors.work}
              onChange={(value) =>
                setWorkAddress({ query: value, selected: null })
              }
              onSelect={(place) =>
                setWorkAddress({ query: place.label, selected: place })
              }
            />
          </div>
          <div className="onboarding-actions">
            <button
              type="button"
              className="onboarding-previous"
              onClick={() => setStep(2)}
              disabled={isSaving}
            >
              ← Précédent
            </button>
            <Button
              type="button"
              variant="secondary"
              disabled={isSaving}
              onClick={() =>
                void finish(selectedModes, selectedAccessibilityPreferences, null, null)
              }
            >
              Passer
            </Button>
            <Button type="button" disabled={isSaving} onClick={finishWithAddresses}>
              {isSaving ? 'Enregistrement…' : 'Terminer'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

interface AccountActionsProps {
  onLogout: () => void;
  /**
   * Appele apres suppression reussie du compte (issue #164) - a la charge
   * de ProfilPage de naviguer/invalider la session (memes garde-fous de
   * transition que handleLogout, voir son commentaire plus bas).
   */
  onAccountDeleted: () => void;
}

/**
 * Actions de compte (deconnexion, suppression du compte - issue #164),
 * communes aux deux etats de ProfilPage (onboarding et formulaire
 * d'edition) - extrait en composant partage plutot que duplique dans les
 * deux branches du rendu, meme motif que ProfileOnboarding ci-dessus.
 *
 * La suppression de compte n'est JAMAIS un simple `confirm()` navigateur
 * (anti-pattern d'accessibilite/UX pour une action destructive et
 * irreversible - critere explicite de l'issue #164, RGPD article 17) :
 * cliquer sur "Supprimer mon compte" bascule vers un second etat de
 * confirmation, avec rappel explicite du caractere definitif de l'action et
 * ressaisie du mot de passe (la seule reponse "oui" a une boite de dialogue
 * ne suffit pas a confirmer une action de cette gravite - meme raisonnement
 * que la reinitialisation de mot de passe, qui exige elle aussi une preuve
 * de possession plutot qu'une simple confirmation cote client).
 */
function AccountActions({ onLogout, onAccountDeleted }: AccountActionsProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    setIsConfirming(false);
    setPassword('');
    setError(null);
  }

  async function confirmDelete() {
    setError(null);
    setIsDeleting(true);
    try {
      await deleteAccount(password);
      onAccountDeleted();
    } catch (err) {
      // Message d'API affiche tel quel (ex. "Mot de passe incorrect", voir
      // UsersService#remove cote backend) - reste sur l'etat de
      // confirmation pour permettre une nouvelle tentative, contrairement a
      // un retour au bouton initial qui ferait perdre le contexte.
      const message =
        err instanceof ApiError ? err.message : 'Une erreur inattendue est survenue.';
      setError(message);
      setIsDeleting(false);
    }
  }

  if (!isConfirming) {
    return (
      <div className="profil-account-actions">
        <Button type="button" variant="secondary" onClick={onLogout} className="profil-logout">
          Se déconnecter
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setIsConfirming(true)}
          className="profil-delete-toggle"
        >
          Supprimer mon compte
        </Button>
      </div>
    );
  }

  return (
    <div className="profil-account-actions">
      <div className="profil-delete-confirm">
        <Alert variant="warning" title="Suppression définitive du compte">
          Votre compte, votre profil de mobilité, votre historique de trajets
          et vos abonnements seront supprimés définitivement. Cette action
          est irréversible.
        </Alert>
        {error && (
          <Alert variant="error" title="Erreur">
            {error}
          </Alert>
        )}
        <FormField
          id="delete-account-password"
          label="Mot de passe (confirmation)"
          type="password"
          icon={<LockIcon />}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
        <div className="profil-delete-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={cancel}
            disabled={isDeleting}
          >
            Annuler
          </Button>
          <Button
            type="button"
            onClick={() => void confirmDelete()}
            disabled={isDeleting || !password}
            className="profil-delete-confirm-btn"
          >
            {isDeleting ? 'Suppression…' : 'Supprimer définitivement'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Reglages d'affichage (issue #245 puis #246) - regroupe les preferences
 * de PRESENTATION cote appareil/navigateur (theme, taille des reperes de
 * carte), toutes deux persistees en localStorage plutot que dans le profil
 * de mobilite backend (voir lib/theme.ts et lib/glyphSize.ts - decision PO
 * explicite documentee dans les deux issues : `accessibilityPreferences`
 * du profil sert au SCORING des itineraires, pas a l'affichage). Commun aux
 * deux etats de ProfilPage (onboarding et formulaire d'edition), meme motif
 * que AccountActions ci-dessus : extrait en composant partage plutot que
 * duplique. Volontairement HORS du <form> de preferences de mobilite (qui
 * n'est soumis qu'au clic sur "Enregistrer", GET/PATCH /profiles/me) : ces
 * reglages ne sont pas une donnee de compte, chacun s'applique
 * immediatement a son propre clic, sans bouton "Enregistrer" dedie ni
 * requete reseau.
 */
function DisplaySettings() {
  return (
    <fieldset className="profil-fieldset">
      <legend>Affichage</legend>
      <ThemeSetting />
      <GlyphSizeSetting />
    </fieldset>
  );
}

/**
 * Reglage de theme (issue #245) - un vrai interrupteur a 2 positions
 * (soleil/lune), pas 3 boutons radio : decision UX prise en session apres
 * une premiere version a 3 options (Systeme/Clair/Sombre), jugee trop
 * lourde pour un reglage que la plupart des gens ne touchent qu'une fois.
 * `useThemeSwitch` gere la position initiale quand aucun choix explicite
 * n'a encore ete fait (suit le theme systeme, voir son commentaire) - au
 * premier clic ici, un choix explicite est enregistre, sans retour arriere
 * possible vers "systeme" depuis ce switch (assume, voir useThemeSwitch).
 */
function ThemeSetting() {
  const [isDark, toggle] = useThemeSwitch();

  return (
    <div className="profil-setting-row">
      <span className="profil-setting-row-label">Thème</span>
      <Switch
        checked={isDark}
        onChange={toggle}
        ariaLabel={
          isDark
            ? 'Thème sombre activé, basculer vers le thème clair'
            : 'Thème clair activé, basculer vers le thème sombre'
        }
        iconOff={<SunIcon />}
        iconOn={<MoonIcon />}
      />
    </div>
  );
}

/**
 * Niveaux du reglage de taille des reperes de carte (issue #246) - tableau
 * plutot que le seul booleen `GlyphSizePreference` actuel ('normal'/'large')
 * : meme motif que TRANSPORT_MODES/THEME_OPTIONS (avant sa bascule en
 * switch pour #245), pour que GlyphSizeSetting reste ecrit une bonne fois
 * pour toutes - un 3e palier futur (ex. "Tres grande") n'ajouterait qu'une
 * entree ici, sans toucher au stepper lui-meme.
 */
const GLYPH_SIZE_LEVELS: { value: GlyphSizePreference; label: string }[] = [
  { value: 'normal', label: 'Normale' },
  { value: 'large', label: 'Grande' },
];

/**
 * Reglage de taille des reperes de la carte (issue #246) - un stepper
 * (boutons -/+ autour du niveau courant), pas un switch comme ThemeSetting
 * ci-dessus : decision UX prise en session - contrairement a "clair/sombre"
 * (une vraie bascule binaire, bien rendue par un interrupteur physique),
 * "normale/grande" se lit plus naturellement comme un CHOIX sur une echelle
 * ordonnee, et le stepper reste utilisable tel quel si un palier
 * intermediaire est ajoute plus tard (voir GLYPH_SIZE_LEVELS) - un switch
 * ne le permettrait pas sans redesign. `aria-live="polite"` sur le libelle
 * du niveau : annonce le changement aux lecteurs d'ecran sans deplacer le
 * focus (les 2 boutons restent sur place, contrairement a un <select> qui
 * aurait avale le focus dans sa propre liste d'options). Boutons desactives
 * en butee (`disabled`) plutot qu'un comportement cyclique (revenir a
 * "Normale" apres "Grande") : plus previsible, et l'etat desactive est
 * lui-meme un signal visuel qu'on est a une extremite.
 */
function GlyphSizeSetting() {
  const [preference, setPreference] = useGlyphSizePreference();
  const index = GLYPH_SIZE_LEVELS.findIndex(
    (level) => level.value === preference,
  );
  const canDecrement = index > 0;
  const canIncrement = index < GLYPH_SIZE_LEVELS.length - 1;

  function decrement() {
    if (canDecrement) setPreference(GLYPH_SIZE_LEVELS[index - 1].value);
  }

  function increment() {
    if (canIncrement) setPreference(GLYPH_SIZE_LEVELS[index + 1].value);
  }

  return (
    <div className="profil-setting-row">
      <span className="profil-setting-row-label" id="glyph-size-label">
        Repères de la carte
      </span>
      <div
        className="profil-stepper"
        role="group"
        aria-labelledby="glyph-size-label"
      >
        <button
          type="button"
          className="profil-stepper-btn"
          onClick={decrement}
          disabled={!canDecrement}
          aria-label="Réduire la taille des repères de la carte"
        >
          <MinusIcon />
        </button>
        <span className="profil-stepper-value" aria-live="polite">
          {GLYPH_SIZE_LEVELS[index].label}
        </span>
        <button
          type="button"
          className="profil-stepper-btn"
          onClick={increment}
          disabled={!canIncrement}
          aria-label="Agrandir les repères de la carte"
        >
          <PlusIcon />
        </button>
      </div>
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
  // Domicile/travail (issue #113/#114) - memes etats que les champs
  // origine/destination de RecherchePage.tsx (issue #35), un par adresse.
  const [homeAddress, setHomeAddress] = useState<AddressFieldState>(EMPTY_ADDRESS);
  const [workAddress, setWorkAddress] = useState<AddressFieldState>(EMPTY_ADDRESS);
  const homeSuggestions = useAddressSuggestions(
    homeAddress.query,
    homeAddress.selected?.label ?? null,
  );
  const workSuggestions = useAddressSuggestions(
    workAddress.query,
    workAddress.selected?.label ?? null,
  );
  const [addressErrors, setAddressErrors] = useState<{
    home?: string;
    work?: string;
  }>({});
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
        // Preremplissage domicile/travail (issue #113/#114) : traite comme
        // une suggestion deja resolue (pas juste un texte tape), pour
        // qu'un "Enregistrer" sans y toucher renvoie la meme valeur
        // (idempotent) plutot que d'exiger une nouvelle selection.
        if (profile.homeLat != null && profile.homeLon != null) {
          const label =
            profile.homeLabel ??
            formatCoordinates(profile.homeLat, profile.homeLon);
          setHomeAddress({
            query: label,
            selected: { label, lat: profile.homeLat, lon: profile.homeLon },
          });
        }
        if (profile.workLat != null && profile.workLon != null) {
          const label =
            profile.workLabel ??
            formatCoordinates(profile.workLat, profile.workLon);
          setWorkAddress({
            query: label,
            selected: { label, lat: profile.workLat, lon: profile.workLon },
          });
        }
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

  /**
   * Suite d'une suppression de compte reussie (issue #164) - meme
   * destination et meme raisonnement que handleLogout ci-dessus (les deux
   * mettent fin a la session) : /recherche reste utilisable sans compte
   * (issue #64), et startTransition() est indispensable pour la meme raison
   * exacte que documentee sur handleLogout (course avec RequireAuth). Les
   * jetons sont deja nettoyes par deleteAccount() (voir lib/auth.ts), pas
   * besoin de rappeler logout() ici.
   */
  function handleAccountDeleted() {
    startTransition(() => {
      navigate('/recherche');
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

    // Adresse tapee mais jamais choisie dans la liste d'autocompletion :
    // traitee comme non resolue (meme motif que RecherchePage.tsx, issue
    // #35) - un champ laisse totalement vide n'est pas une erreur, il
    // signifie simplement "ne rien envoyer pour cette adresse" (voir plus
    // bas).
    const errors: { home?: string; work?: string } = {};
    if (homeAddress.query.trim() && !homeAddress.selected) {
      errors.home =
        'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.';
    }
    if (workAddress.query.trim() && !workAddress.selected) {
      errors.work =
        'Adresse non résolue. Sélectionnez une adresse dans la liste de suggestions.';
    }
    setAddressErrors(errors);
    if (errors.home || errors.work) return;

    setIsSaving(true);

    try {
      await updateProfile({
        preferredTransportModes: selectedModes,
        accessibilityPreferences: selectedAccessibilityPreferences,
        // Domicile/travail (issue #113/#114) : omis entierement si non
        // resolu (champ vide) - pas de semantique "effacer" cote backend a
        // ce jour (voir docs/sprints/sprint-3-plan.md, PR #140), un champ
        // vide laisse donc l'adresse deja enregistree intacte plutot que de
        // l'effacer.
        ...(homeAddress.selected
          ? {
              homeLabel: homeAddress.selected.label,
              homeLat: homeAddress.selected.lat,
              homeLon: homeAddress.selected.lon,
            }
          : {}),
        ...(workAddress.selected
          ? {
              workLabel: workAddress.selected.label,
              workLat: workAddress.selected.lat,
              workLon: workAddress.selected.lon,
            }
          : {}),
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
        <Skeleton count={3} />
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
        <DisplaySettings />
        <AccountActions
          onLogout={handleLogout}
          onAccountDeleted={handleAccountDeleted}
        />
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

        {/* Bloc separe des 2 fieldsets ci-dessus (issue #113/#114) - pas
            dans .profil-fieldsets (grille a 2 colonnes en desktop) : passer
            a 3 colonnes serait trop serre pour des champs d'adresse. */}
        <fieldset className="profil-fieldset profil-addresses">
          <legend>Domicile et travail</legend>
          <p className="profil-addresses-hint">
            Utilisées comme raccourcis d'origine lors d'une recherche.
          </p>
          <div className="profil-addresses-fields">
            <AddressField
              id="home-address"
              label="Domicile"
              value={homeAddress.query}
              suggestions={homeSuggestions}
              error={addressErrors.home}
              onChange={(value) =>
                setHomeAddress({ query: value, selected: null })
              }
              onSelect={(place) =>
                setHomeAddress({ query: place.label, selected: place })
              }
            />
            <AddressField
              id="work-address"
              label="Travail"
              value={workAddress.query}
              suggestions={workSuggestions}
              error={addressErrors.work}
              onChange={(value) =>
                setWorkAddress({ query: value, selected: null })
              }
              onSelect={(place) =>
                setWorkAddress({ query: place.label, selected: place })
              }
            />
          </div>
        </fieldset>

        <Button type="submit" disabled={isSaving} className="profil-submit">
          {isSaving ? 'Enregistrement…' : 'Enregistrer'}
        </Button>
      </form>

      {/* Hors du <form> : ne doit pas pouvoir etre declenche par un Entree
          dans un champ du formulaire de profil (comportement par defaut
          d'un bouton submit a l'interieur d'un <form>). Meme raison pour
          DisplaySettings juste en dessous (issue #245/#246), meme si elle
          ne contient aucun bouton submit - reste hors du <form> de
          preferences de mobilite par coherence, ce n'est pas une donnee de
          ce formulaire. */}
      <DisplaySettings />
      <AccountActions
        onLogout={handleLogout}
        onAccountDeleted={handleAccountDeleted}
      />
    </section>
  );
}

export default ProfilPage;
