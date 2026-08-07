import { type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import FormField from '../../components/FormField/FormField';
import { EnvelopeIcon } from '../../components/icons';
import { ApiError } from '../../lib/api';
import { forgotPassword } from '../../lib/auth';
import './MotDePasseOubliePage.css';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Ecran de demande de reinitialisation de mot de passe (issue #71).
 *
 * Le backend repond TOUJOURS 200 avec un message generique, que l'email
 * existe ou non (pas d'enumeration, voir AuthService.forgotPassword) : cet
 * ecran n'a donc jamais a distinguer les deux cas, seulement afficher ce
 * message une fois la demande envoyee. Une fois succes obtenu, le
 * formulaire disparait au profit du message - pas de champ a re-remplir,
 * pas de tentation de renvoyer la demande par erreur.
 */
function MotDePasseOubliePage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError(null);

    if (!EMAIL_PATTERN.test(email)) {
      setEmailError('Adresse email invalide');
      return;
    }
    setEmailError(undefined);

    setIsSubmitting(true);
    try {
      const { message } = await forgotPassword(email);
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

  return (
    <section className="mot-de-passe-oublie-page">
      <h1>Mot de passe oublié</h1>

      <div className="mot-de-passe-oublie-card">
        {successMessage ? (
          <>
            <Alert variant="success" title="Demande envoyée">
              {successMessage}
            </Alert>
            <Link to="/connexion" className="mot-de-passe-oublie-back-link">
              Retour à la connexion
            </Link>
          </>
        ) : (
          <>
            <p>
              Indiquez votre adresse email : si un compte y est associé, un
              lien de réinitialisation vous sera envoyé.
            </p>

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
                error={emailError}
              />
              <Button
                type="submit"
                disabled={isSubmitting}
                className="mot-de-passe-oublie-submit"
              >
                {isSubmitting ? 'Un instant…' : 'Envoyer le lien'}
              </Button>
            </form>
          </>
        )}
      </div>
    </section>
  );
}

export default MotDePasseOubliePage;
