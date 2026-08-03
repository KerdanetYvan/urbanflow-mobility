import {
  BikeIcon,
  BusIcon,
  CarIcon,
  OtherModeIcon,
  ScooterIcon,
  WalkIcon,
} from './icons';

/**
 * Association mode OTP (ex. "WALK", "BUS") -> icone a afficher (issue #36,
 * ecran de resultats). Memes cles que MODE_STYLES
 * (components/MapView/modeStyles.ts) mais un seul pictogramme generique
 * pour tout transport en commun (BUS/TRAM/RAIL/SUBWAY), le libelle textuel
 * suffisant a les distinguer sur cet ecran.
 *
 * Fichier separe de icons.tsx (qui n'exporte que des composants) : cette
 * fonction n'en est pas un (nom en camelCase, pas de props), la melanger
 * aux composants casserait le fast refresh (react-refresh/only-export-components).
 */
const TRIP_MODE_ICONS: Record<string, () => ReturnType<typeof WalkIcon>> = {
  WALK: WalkIcon,
  BICYCLE: BikeIcon,
  SCOOTER: ScooterIcon,
  CAR: CarIcon,
  BUS: BusIcon,
  TRAM: BusIcon,
  RAIL: BusIcon,
  SUBWAY: BusIcon,
};

export function getTripModeIcon(mode: string) {
  const Icon = TRIP_MODE_ICONS[mode] ?? OtherModeIcon;
  return <Icon />;
}
