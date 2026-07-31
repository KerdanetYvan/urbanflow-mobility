/** Forme renvoyee par GET /places (issue #81) - une suggestion de lieu. */
export interface PlaceSuggestion {
  /** Texte affichable dans la liste d'autocompletion (ex. "Gare Test"). */
  label: string;
  lat: number;
  lon: number;
}
