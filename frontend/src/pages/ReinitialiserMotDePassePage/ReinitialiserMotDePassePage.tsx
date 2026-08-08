import { type FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { LockIcon } from '../../components/icons';
import { ApiError } from '../../lib/api';
import { resetPassword } from '../../lib/auth';
import './ReinitialiserMotDePassePage.css';

interface FieldErrors {
  password?: string;
  confirmPassword?: string;
}

/**
 * Meme regle et meme message que ConnexionPage.tsx (mode inscription) et
 * backend/src/common/validators/password.validator.ts.
 */
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial';

/**
 * Ecran de confirmation de reinitialisation de mot de passe (issue #71).
 *
 * URL figee cote backend (AuthService.forgotPassword construit le lien
 * envoye par email en ${FRONTEND_URL}/reset-password?token=...) : ce
 * composant DOIT rester monte sur la route /reset-password, voir App.tsx.
 *
 * Pas de connexion automatique apres succes : POST /auth/reset-password
 * n'emet aucun jeton (voir AuthService cote backend), contrairement a
 * l'inscription qui enchaine elle-meme un login().
 */
function ReinitialiserMotDePassePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  function validate(): boolean {
    const errors: FieldErrors = {};

    if (!PASSWORD_PATTERN.test(password)) {
      errors.password = PASSWORD_MESSAGE;
    }
    if (confirmPassword !== password) {
      errors.confirmPassword = 'Les mots de passe ne correspondent pas';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!token || !validate()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { message } = await resetPassword(token, password);
      setSuccessMessage(message);
    } catch (error) {
      const message =
        error instanceof ApiError
          ? error.message
          : 'Une erreur inattendue est survenue';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!token) {
    return (
      <section className="reinitialiser-mdp-page">
        <h1>Réinitialiser le mot de passe</h1>
        <div className="reinitialiser-mdp-card">
          <Alert variant="error" title="Lien invalide">
            Ce lien de réinitialisation est invalide. Redemandez-en un
            nouveau.
          </Alert>
          <Link
            to="/mot-de-passe-oublie"
            className="reinitialiser-mdp-back-link"
          >
            Redemander un lien
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="reinitialiser-mdp-page">
      <h1>Réinitialiser le mot de passe</h1>

      <div className="reinitialiser-mdp-card">
        {successMessage ? (
          <>
            <Alert variant="success" title="Mot de passe réinitialisé">
              {successMessage}
            </Alert>
            <Link to="/connexion" className="reinitialiser-mdp-back-link">
              Se connecter
            </Link>
          </>
        ) : (
          <>
            {submitError && (
              <Alert variant="error" title="Erreur">
                {submitError}
              </Alert>
            )}

            <form onSubmit={(event) => void handleSubmit(event)} noValidate>
              {/* Cote a cote a partir de 768px (issue #73, spec 5.1). */}
              <div className="reinitialiser-mdp-passwords">
                <FormField
                  id="password"
                  label="Nouveau mot de passe"
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
              <Button
                type="submit"
                disabled={isSubmitting}
                className="reinitialiser-mdp-submit"
              >
                {isSubmitting ? 'Un instant…' : 'Réinitialiser'}
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export default ReinitialiserMotDePassePage;
