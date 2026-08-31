/** Formate une duree en secondes en texte court ("45 min", "1h 20min") - reutilise par l'affichage carte (#8) et la liste de resultats (#36). */
export function formatDuration(durationSeconds: number): string {
  const totalMinutes = Math.round(durationSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}min`;
}

/** Accorde "correspondance(s)" au singulier/pluriel selon le nombre. */
export function formatTransfers(transfers: number): string {
  return transfers === 0
    ? 'Aucune correspondance'
    : `${transfers} correspondance${transfers > 1 ? 's' : ''}`;
}

/** Formate une date ISO en heure courte ("08:05"), utilise par l'ecran de resultats (#36). */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formate l'heure du prochain creneau propose (issue #91) relativement au
 * jour demande : "a 08:05" si c'est le meme jour calendaire que
 * `requestedIso`, sinon "<jour de la semaine> a 08:05" (ex. "vendredi a
 * 08:05"). La fenetre de recherche etant plafonnee a 24h cote backend,
 * l'ecart ne depasse jamais un jour, le nom du jour reste donc sans
 * ambiguite.
 */
export function formatNextDeparture(
  actualIso: string,
  requestedIso: string,
): string {
  const actual = new Date(actualIso);
  const requested = new Date(requestedIso);
  const sameCalendarDay =
    actual.getFullYear() === requested.getFullYear() &&
    actual.getMonth() === requested.getMonth() &&
    actual.getDate() === requested.getDate();

  const time = formatTime(actualIso);
  if (sameCalendarDay) return `à ${time}`;

  const weekday = actual.toLocaleDateString('fr-FR', { weekday: 'long' });
  return `${weekday} à ${time}`;
}

/**
 * Repli d'affichage de coordonnees brutes ("45.7640, 4.8600") quand aucun
 * libelle d'adresse n'est disponible - cas d'une entree d'historique dont la
 * recherche d'origine n'etait pas authentifiee au moment ou le libelle
 * aurait pu etre fourni (voir TripHistoryEntry, issue #11). Reutilise par
 * l'ecran d'historique (#11) et les raccourcis de recherche rapide (#112).
 */
export function formatCoordinates(lat: number, lon: number): string {
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}
