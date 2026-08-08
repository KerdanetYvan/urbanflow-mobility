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

/**
 * Icones par mode de transport (issue #36, voir
 * docs/specs/f2-ecrans-planification.md section 5) - une par mode affiche
 * sur les cartes-itineraire de l'ecran de resultats. Meme convention que le
 * reste de ce fichier (SVG monoline, currentColor, pas d'emoji).
 */
export function WalkIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="13" cy="4.5" r="1.8" />
      <path d="M10.5 21 12 15l-2.5-2 .5-4.5 3 1 1.5 3 3 1.5" />
      <path d="m12 15 3 1.5-1 4.5" />
      <path d="m9.5 13-3 1.5-2 4" />
    </svg>
  );
}

export function BikeIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="6" cy="17" r="3.2" />
      <circle cx="18" cy="17" r="3.2" />
      <path d="M6 17 10 9h4l3 4.5h3" />
      <path d="M10 9 8.5 6.5H6" />
      <path d="m10 9 4.5 8" />
    </svg>
  );
}

export function ScooterIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="5.5" cy="17.5" r="2.3" />
      <circle cx="17.5" cy="17.5" r="2.3" />
      <path d="M5.5 15.2V9.5h9" />
      <path d="M14.5 9.5h3l1 6" />
      <path d="M17.5 6.5h2.5" />
    </svg>
  );
}

/** Transport en commun (bus/tram/metro/train) - un seul pictogramme generique pour les 4, distingues par leur libelle (voir modeStyles.ts). */
export function BusIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="4" y="4" width="16" height="12" rx="2" />
      <path d="M4 11h16" />
      <circle cx="8" cy="18.5" r="1.3" />
      <circle cx="16" cy="18.5" r="1.3" />
    </svg>
  );
}

export function CarIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 16v-3.5L6 8h12l2 4.5V16" />
      <path d="M4 16h16" />
      <circle cx="7.5" cy="16" r="1.6" />
      <circle cx="16.5" cy="16" r="1.6" />
    </svg>
  );
}

/** Mode non repertorie - meme role que DEFAULT_MODE_STYLE dans modeStyles.ts. */
export function OtherModeIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}

/** Point de correspondance entre deux segments (issue #36). */
export function TransferIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" strokeDasharray="2 4" />
    </svg>
  );
}

/**
 * Icones de la navigation principale (AppLayout, issue #73/docs/specs/
 * refonte-visuelle-mobile-desktop.md section 3.2). "Connexion" reutilise
 * LockIcon (deja utilisee sur le champ mot de passe des ecrans
 * d'authentification, coherente visuellement) - pas de nouvelle icone dediee.
 */
export function SearchIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
    </svg>
  );
}

export function UserIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
    </svg>
  );
}

export function HistoryIcon() {
  return (
    <svg {...iconProps()}>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9v4l3 2" />
      <path d="M8.5 3.5 5 6" />
      <path d="M15.5 3.5 19 6" />
    </svg>
  );
}
