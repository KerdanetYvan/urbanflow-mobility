import type { ButtonHTMLAttributes } from 'react';
import './Button.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Style visuel : "primary" pour l'action principale, "secondary" sinon.
   *  Un seul bouton primaire par ecran, en general (hierarchie visuelle). */
  variant?: 'primary' | 'secondary';
}

/**
 * Bouton commun a toute l'application, applique la charte graphique
 * (issue #52) : couleurs, rayon, cible tactile minimale (44px), et un
 * anneau de focus qui reprend la couleur du bouton (voir Button.css).
 */
function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const variantClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  const classes = ['btn', variantClass, className].filter(Boolean).join(' ');

  return <button className={classes} {...props} />;
}

export default Button;
