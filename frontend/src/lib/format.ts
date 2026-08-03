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
