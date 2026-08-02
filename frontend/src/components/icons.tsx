/**
 * Petites icones ligne (monoline) en SVG inline plutot que des emojis :
 * rendu identique quel que soit l'OS/navigateur (les emojis varient
 * fortement de style d'une plateforme a l'autre), et `currentColor`
 * permet de suivre automatiquement la couleur de texte (donc le theme
 * sombre) sans variable dediee.
 */

function iconProps(size = 18) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function EnvelopeIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

/** Marqueur de lieu, utilise pour les champs origine et destination (issue #35). */
export function MapPinIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M12 21s-7-6.2-7-11.5a7 7 0 1 1 14 0C19 14.8 12 21 12 21Z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  );
}

/**
 * Fleches opposees verticales, pour le bouton d'inversion origine/destination
 * (issue #35) - suggere un echange plutot qu'une simple direction unique.
 */
export function SwapIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M7 4v13" />
      <path d="m3.5 14 3.5 3.5L10.5 14" />
      <path d="M17 20V7" />
      <path d="m13.5 10 3.5-3.5L20.5 10" />
    </svg>
  );
}
