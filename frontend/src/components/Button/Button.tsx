import { forwardRef, type ButtonHTMLAttributes } from 'react';
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
 *
 * forwardRef (issue #109) : necessaire pour les appelants qui doivent
 * reprendre la main sur le focus DOM du bouton (ex. TransportModesFilter,
 * RecherchePage.tsx, qui rend le focus au declencheur a la fermeture du
 * panneau) - transparent pour les appelants existants, qui ne passent pas
 * de ref.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', className, ...props },
  ref,
) {
  const variantClass = variant === 'primary' ? 'btn-primary' : 'btn-secondary';
  const classes = ['btn', variantClass, className].filter(Boolean).join(' ');

  return <button ref={ref} className={classes} {...props} />;
});

export default Button;
