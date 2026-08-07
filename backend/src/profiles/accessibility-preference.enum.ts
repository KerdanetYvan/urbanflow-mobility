/**
 * Preferences d'accessibilite disponibles dans un profil de mobilite.
 * Enum plutot que colonnes booleennes dediees (voir TransportMode) : ajouter
 * une preference future n'exige qu'une nouvelle valeur ici, pas une
 * migration de colonne. Chaque valeur cochee/decochee est pensee comme une
 * entree de ponderation pour le futur service de scoring (partie 7.3 du
 * dossier) - jamais comme un seuil numerique (elimine des trajets au lieu
 * de les classer) ni un champ libre (inexploitable par une formule).
 */
export enum AccessibilityPreference {
  WHEELCHAIR_ACCESSIBLE = 'wheelchair_accessible',
  LIMIT_WALKING_DISTANCE = 'limit_walking_distance',
  LIMIT_TRANSFERS = 'limit_transfers',
}
