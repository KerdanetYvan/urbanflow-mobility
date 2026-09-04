import type { ReactNode } from 'react';
import './Switch.css';

interface SwitchProps {
  /** État courant (false = position "off"/gauche, true = "on"/droite). */
  checked: boolean;
  /** Appelé au clic - bascule vers l'état oppose, c'est a l'appelant de decider quoi en faire (voir ThemeSetting/GlyphSizeSetting dans ProfilPage.tsx). */
  onChange: () => void;
  /** Annonce aux technologies d'assistance (voir aria-checked) - doit decrire l'etat ET l'action, meme convention que ThemeSetting avant extraction. */
  ariaLabel: string;
  /** Icone affichee cote "off" (gauche), mise en avant quand `checked` est false. */
  iconOff: ReactNode;
  /** Icone affichee cote "on" (droite), mise en avant quand `checked` est true. */
  iconOn: ReactNode;
}

/**
 * Interrupteur generique a 2 positions (extrait de ThemeSetting, issue #245,
 * a l'occasion de #246 qui introduit un second reglage avec exactement le
 * meme besoin - taille des reperes de la carte plutot que theme). Piste
 * ovale contenant les 2 icones fixes a chaque extremite, un disque qui
 * glisse par-dessus l'icone active - voir Switch.css pour le detail visuel
 * (profondeur, hover, centrage). `role="switch"`/`aria-checked` (pas une
 * checkbox stylee en CSS pur) : semantique ARIA dediee, annoncee
 * correctement par les lecteurs d'ecran comme un interrupteur plutot qu'une
 * case a cocher. Sans etat interne : purement controle par `checked`/
 * `onChange`, chaque appelant reste seul responsable de sa propre logique
 * de persistance (localStorage, voir lib/theme.ts et lib/glyphSize.ts).
 */
function Switch({ checked, onChange, ariaLabel, iconOff, iconOn }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="switch"
      onClick={onChange}
    >
      <span className="switch-icon switch-icon-off" aria-hidden="true">
        {iconOff}
      </span>
      <span className="switch-icon switch-icon-on" aria-hidden="true">
        {iconOn}
      </span>
      <span className="switch-thumb" aria-hidden="true" />
    </button>
  );
}

export default Switch;
