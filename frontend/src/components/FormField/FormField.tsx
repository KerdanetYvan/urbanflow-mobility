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
  /**
   * Masque visuellement le `<label>` tout en le laissant dans le DOM pour
   * les lecteurs d'ecran (issue #233, champs origine/destination compacts
   * de `/recherche`) - jamais un `placeholder` utilise SEUL comme label
   * (anti-pattern d'accessibilite documente ci-dessus, deja atteste par
   * l'audit WCAG 2.1 AA #20) : le texte du label sert de `placeholder`
   * natif de l'input pour l'utilisateur voyant, un vrai `<label>`
   * visuellement masque (`.field-label-sr-only`) reste associe a l'input
   * pour tout lecteur d'ecran.
   */
  hideLabel?: boolean;
}

/**
 * Champ de formulaire standard : label toujours visible par defaut (jamais
 * de placeholder utilise comme SEUL label - anti-pattern d'accessibilite),
 * et gestion d'un etat d'erreur relie a l'input via aria-invalid/
 * aria-describedby pour les lecteurs d'ecran (voir issue #52). `hideLabel`
 * (issue #233) permet un rendu visuel compact sans jamais retirer le label
 * du DOM - voir le commentaire de la prop ci-dessus.
 */
function FormField({
  id,
  label,
  error,
  helpText,
  icon,
  hideLabel,
  className,
  placeholder,
  ...inputProps
}: FormFieldProps) {
  const messageId = error ? `${id}-error` : helpText ? `${id}-help` : undefined;

  return (
    <div className={['field', error && 'has-error', className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={hideLabel ? 'field-label-sr-only' : undefined}>
        {label}
      </label>
      <div className="field-input-wrapper">
        {icon && <span className="field-icon">{icon}</span>}
        <input
          id={id}
          className={icon ? 'has-icon' : undefined}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={messageId}
          placeholder={placeholder ?? (hideLabel ? label : undefined)}
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
