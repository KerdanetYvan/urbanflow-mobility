import { startTransition, type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { EnvelopeIcon, LockIcon } from '../../components/icons';
import { login, register } from '../../lib/auth';
import { ApiError } from '../../lib/api';
import { getMyProfile } from '../../lib/profile';
import { useAuth } from '../../lib/useAuth';
import './ConnexionPage.css';

type Mode = 'login' | 'register';

interface FieldErrors {
  email?: string;
  password?: string;
  confirmPassword?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Meme regle et meme message que cote backend (voir
 * backend/src/users/dto/create-user.dto.ts) : au moins 8 caracteres, une
 * majuscule, une minuscule, un chiffre et un caractere special.
 */
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial';

/**
 * Ecran de connexion/inscription (F1, issue #33).
 *
 * Un seul ecran, deux modes bascules par un toggle : ca evite de dupliquer
 * la route et le layout pour deux formulaires tres proches l'un de l'autre.
 *
 * L'inscription n'est pas auto-connectee cote backend (POST /users cree le
 * compte sans emettre de jetons, voir issue #3) : cet ecran enchaine donc
 * lui-meme un login() juste apres un register() reussi, pour eviter a
 * l'utilisateur de retaper ses identifiants immediatement apres inscription.
 */
function ConnexionPage() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function switchMode(nextMode: Mode) {
    setMode(nextMode);
    setFieldErrors({});
    setSubmitError(null);
  }

  /**
   * Validation cote client : donne un retour immediat sans aller-retour
   * reseau pour les cas evidents. Le backend revalide de toute facon tout
   * (jamais faire confiance uniquement a la validation cote client).
   */
  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!EMAIL_PATTERN.test(email)) {
      errors.email = 'Adresse email invalide';
    }

    if (mode === 'register' && !PASSWORD_PATTERN.test(password)) {
      errors.password = PASSWORD_MESSAGE;
    } else if (mode === 'login' && password.length === 0) {
      errors.password = 'Le mot de passe est requis';
    }

    if (mode === 'register' && confirmPassword !== password) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  /**
   * Destination post-connexion (issue #106/#107, docs/specs/
   * onboarding-profil-redirection.md section 2) : /recherche si
   * l'utilisateur a deja un profil de mobilite, /profil sinon (declenche
   * l'onboarding, voir ProfilPage.tsx). login()/register() ne renvoient que
   * des jetons (voir lib/auth.ts) - GET /profiles/me est le seul moyen de
   * savoir si un profil existe deja.
   *
   * Repli sur /recherche si ce controle lui-meme echoue (reseau/500, pas un
   * 404 propre) : /recherche reste utilisable sans profil (issue #64),
   * alors que rediriger vers /profil dans ce cas exposerait immediatement
   * son propre ecran d'erreur juste apres une connexion par ailleurs
   * reussie (spec section 2.2, "fail-open").
   */
  async function resolvePostLoginDestination(): Promise<string> {
    try {
      await getMyProfile();
      return '/recherche';
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        return '/profil';
      }
      return '/recherche';
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'register') {
        await register(email, password);
      }
      await login(email, password);
      const destination = await resolvePostLoginDestination();
      // startTransition() indispensable ici, meme raison que
      // ProfilPage.tsx#handleLogout : navigate() de react-router-dom v7 est
      // une mise a jour basse priorite (sa propre transition interne),
      // tandis que setAuthenticated() est normale/haute priorite. Sans les
      // grouper dans la MEME transition, setAuthenticated(true) se
      // commettrait seul en premier, avec la route encore sur /connexion -
      // RedirectIfAuthenticated s'y re-rendrait alors avec une session
      // valide et imposerait SA PROPRE redirection (toujours vers /profil,
      // codee en dur) avant que notre navigate(destination) n'ait eu la
      // main, ecrasant silencieusement /recherche par /profil quand les
      // deux destinations different (constate en session, regression
      // reproduite dans App.spec.tsx).
      startTransition(() => {
        setAuthenticated(true);
        navigate(destination);
      });
    } catch (error) {
      // Message renvoye tel quel par l'API (voir ApiError) : deja pense
      // pour etre affiche directement (ex. "Email ou mot de passe incorrect").
      const message =
        error instanceof ApiError ? error.message : 'Une erreur inattendue est survenue';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="connexion-page">
      <h1>{mode === 'login' ? 'Connexion' : 'Créer un compte'}</h1>

      <div className="connexion-card">
        <div className="connexion-tabs" role="tablist" aria-label="Choix connexion ou inscription">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className="connexion-tab"
            onClick={() => switchMode('login')}
          >
            Se connecter
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            className="connexion-tab"
            onClick={() => switchMode('register')}
          >
            Créer un compte
          </button>
        </div>

        {submitError && (
          <Alert variant="error" title="Erreur">
            {submitError}
          </Alert>
        )}

        <form onSubmit={(event) => void handleSubmit(event)} noValidate>
          <FormField
            id="email"
            label="Adresse email"
            type="email"
            autoComplete="email"
            icon={<EnvelopeIcon />}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldErrors.email}
          />
          {mode === 'login' ? (
            <>
              <FormField
                id="password"
                label="Mot de passe"
                type="password"
                autoComplete="current-password"
                icon={<LockIcon />}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
              />
              <Link to="/mot-de-passe-oublie" className="connexion-forgot-link">
                Mot de passe oublié ?
              </Link>
            </>
          ) : (
            // Cote a cote a partir de 768px (issue #73, spec 5.1) - voir
            // .connexion-passwords dans ConnexionPage.css.
            <div className="connexion-passwords">
              <FormField
                id="password"
                label="Mot de passe"
                type="password"
                autoComplete="new-password"
                icon={<LockIcon />}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={fieldErrors.password}
                helpText="8 caractères min., avec majuscule, minuscule, chiffre et caractère spécial"
              />
              <FormField
                id="confirm-password"
                label="Confirmer le mot de passe"
                type="password"
                autoComplete="new-password"
                icon={<LockIcon />}
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                error={fieldErrors.confirmPassword}
              />
            </div>
          )}
          <Button type="submit" disabled={isSubmitting} className="connexion-submit">
            {isSubmitting
              ? 'Un instant…'
              : mode === 'login'
                ? 'Se connecter'
                : 'Créer mon compte'}
          </Button>
        </form>
      </div>
    </section>
  );
}

export default ConnexionPage;
