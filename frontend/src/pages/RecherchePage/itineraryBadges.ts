import type { TripItinerary } from '../../lib/trips';

/**
 * Badge affiche sur l'itineraire deja en tete de liste (section 2.2 de
 * docs/specs/f3-scoring-perturbations.md, issue #26) - renforce visuellement
 * pourquoi il est premier, sans jamais reveler la valeur de score qui l'a
 * classe ainsi (calcul reste dans ScoringService, backend/src/scoring).
 */
export const BEST_OVERALL_BADGE_LABEL = 'Le plus adapté à vos critères';

/**
 * Un critere de profil pouvant produire le badge "cible" optionnel (section
 * 2.2) : `preference` est la valeur de `accessibilityPreferences` (voir
 * frontend/src/lib/profile.ts) qui le declenche, `metric` la quantite a
 * MINIMISER pour trouver l'itineraire qui satisfait le mieux ce critere
 * precis parmi les resultats affiches.
 */
interface TargetedCriterion {
  preference: string;
  badgeLabel: string;
  metric: (itinerary: TripItinerary) => number;
}

/**
 * Un seul badge cible peut s'afficher (section 2.2 : "2 badges maximum sur
 * l'ensemble de la liste"). Si plusieurs preferences ciblees sont cochees
 * simultanement, l'ordre de ce tableau fait office de priorite : on prend le
 * premier critere trouve. `limit_transfers` passe avant `limit_walking_distance`
 * car il pese davantage dans le scoring pondere (25 % contre aucun poids
 * dedie a la marche, voir docs/specs/f3-scoring-perturbations.md section
 * 4.2). `wheelchair_accessible` est volontairement absent de cette liste :
 * c'est un filtre dur transmis a OpenTripPlanner en amont (section 4.1), pas
 * une preference classante - tous les itineraires renvoyes le respectent
 * deja si l'utilisateur l'a coche, aucun ne s'en distingue.
 */
const TARGETED_CRITERIA: TargetedCriterion[] = [
  {
    preference: 'limit_transfers',
    badgeLabel: 'Le moins de correspondances',
    metric: (itinerary) => itinerary.transfers,
  },
  {
    preference: 'limit_walking_distance',
    badgeLabel: 'Le moins de marche à pied',
    metric: (itinerary) =>
      itinerary.segments
        .filter((segment) => segment.mode === 'WALK')
        .reduce((total, segment) => total + segment.distanceMeters, 0),
  },
];

/**
 * Libelles de badges a afficher par index d'itineraire dans la liste deja
 * triee recue de GET /trips - un index absent de cet objet n'affiche aucun
 * badge. Voir RecherchePageResults.tsx (ItineraryCard) pour le rendu.
 */
export type ItineraryBadges = Record<number, string[]>;

/**
 * Calcule les badges qualitatifs de scoring a afficher sur la liste de
 * resultats (section 2.2 de la spec F3) :
 * - l'itineraire d'index 0 (deja en tete du tri backend) recoit toujours le
 *   badge "meilleur choix global" ;
 * - si une preference d'`accessibilityPreferences` correspond a un critere
 *   cible connu, l'itineraire qui le satisfait le mieux recoit en plus (ou a
 *   la place, si c'est un autre itineraire) le badge dedie a ce critere.
 *
 * Ne mute jamais le tableau `itineraries` recu, coherent avec la meme regle
 * deja appliquee par ScoringService cote backend. Le total de libelles
 * renvoyes ne depasse jamais 2, par construction (un seul badge global, un
 * seul badge cible au maximum) et non par verification a posteriori.
 *
 * @param itineraries Itineraires deja tries par le backend (GET /trips) - l'ordre n'est jamais recalcule ici.
 * @param accessibilityPreferences Preferences cochees dans le profil de mobilite (frontend/src/lib/profile.ts) - tableau vide pour un profil incomplet ou une recherche anonyme (issue #64).
 * @returns Les libelles de badge a afficher, indexes par position dans `itineraries`.
 */
export function computeItineraryBadges(
  itineraries: TripItinerary[],
  accessibilityPreferences: string[],
): ItineraryBadges {
  const badges: ItineraryBadges = {};
  if (itineraries.length === 0) return badges;

  // Le premier itineraire de la liste deja triee est toujours le "meilleur
  // choix global" (c'est litteralement ce que le tri backend signifie).
  badges[0] = [BEST_OVERALL_BADGE_LABEL];

  // Si aucun critere n'est explicitement prioritaire pour l'utilisateur
  // (profil incomplet ou recherche sans compte), seul le badge global
  // s'affiche (section 2.2, derniere regle).
  const criterion = TARGETED_CRITERIA.find((candidate) =>
    accessibilityPreferences.includes(candidate.preference),
  );
  if (!criterion) return badges;

  // Recherche lineaire de l'itineraire qui minimise la metrique du critere
  // cible parmi les resultats affiches (correspondances ou marche cumulee).
  let bestIndex = 0;
  let bestValue = criterion.metric(itineraries[0]);
  for (let index = 1; index < itineraries.length; index++) {
    const value = criterion.metric(itineraries[index]);
    if (value < bestValue) {
      bestValue = value;
      bestIndex = index;
    }
  }

  // Si le meilleur choix global satisfait deja le mieux ce critere, les deux
  // libelles s'accumulent sur la meme carte (toujours <= 2 badges au total).
  badges[bestIndex] = [...(badges[bestIndex] ?? []), criterion.badgeLabel];
  return badges;
}
