import type { InputHTMLAttributes, ReactNode } from 'react';
import './FormField.css';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** Identifiant unique, partage entre le <label>, l'<input> et le message d'aide/erreur. */
  id: string;
  label: string;
  /** Message d'erreur a afficher sous le champ ; sa seule presence bascule le champ en etat "erreur". */
  error?: string;
  /** Texte d'aide affiche sous le champ quand il n'y a pas d'erreur. */
  helpText?: string;
  /** Icone decorative affichee dans le champ (voir components/icons.tsx). Purement visuelle : aria-hidden, le label reste la seule information portee aux lecteurs d'ecran. */
  icon?: ReactNode;
}

/**
 * Champ de formulaire standard : label toujours visible (jamais de
 * placeholder utilise comme seul label - anti-pattern d'accessibilite),
 * et gestion d'un etat d'erreur relie a l'input via aria-invalid/
 * aria-describedby pour les lecteurs d'ecran (voir issue #52).
 */
function FormField({
  id,
  label,
  error,
  helpText,
  icon,
  className,
  ...inputProps
}: FormFieldProps) {
  const messageId = error ? `${id}-error` : helpText ? `${id}-help` : undefined;

  return (
    <div className={['field', error && 'has-error', className].filter(Boolean).join(' ')}>
      <label htmlFor={id}>{label}</label>
      <div className="field-input-wrapper">
        {icon && <span className="field-icon">{icon}</span>}
        <input
          id={id}
          className={icon ? 'has-icon' : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={messageId}
          {...inputProps}
        />
      </div>
      {error && (
        <p className="field-error" id={messageId}>
          <span aria-hidden="true">⚠</span> {error}
        </p>
      )}
      {!error && helpText && (
        <p className="field-help" id={messageId}>
          {helpText}
        </p>
      )}
    </div>
  );
}

export default FormField;
