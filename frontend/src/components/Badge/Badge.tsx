import type { ReactNode } from 'react';
import './Badge.css';

interface BadgeProps {
  children: ReactNode;
}

/**
 * Pastille qualitative (issue #126, section 2.2 de docs/specs/
 * f3-scoring-perturbations.md) - met en avant un choix de la liste de
 * resultats ("meilleur choix global", ou cible sur un critere prioritaire du
 * profil), jamais une valeur de score. Un seul style, contrairement a
 * `Alert` (variant success/warning/error/info) : les deux badges possibles
 * se distinguent uniquement par leur texte, jamais par une couleur
 * differente (WCAG 1.4.1 - "Use of Color").
 */
function Badge({ children }: BadgeProps) {
  return <span className="badge">{children}</span>;
}

export default Badge;
