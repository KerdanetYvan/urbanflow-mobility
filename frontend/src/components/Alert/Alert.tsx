import type { ReactNode } from 'react';
import './Alert.css';

interface AlertProps {
  variant: 'success' | 'warning' | 'error' | 'info';
  title: string;
  children: ReactNode;
}

const ICONS: Record<AlertProps['variant'], string> = {
  success: '✔',
  warning: '⚠',
  error: '✕',
  info: 'ℹ',
};

/**
 * Bandeau de message (succes/warning/erreur/info), issu de l'apercu de
 * charte graphique (issue #52) : icone dans une pastille ronde en couleur
 * pleine, encadre teinte tres clair, titre + texte jamais portes par la
 * couleur seule (WCAG 1.4.1 - "Use of Color").
 *
 * `role="alert"` : annonce automatiquement le message aux lecteurs d'ecran
 * des qu'il apparait dans le DOM, sans action de l'utilisateur.
 */
function Alert({ variant, title, children }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`} role="alert">
      <span className="alert-icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}

export default Alert;
