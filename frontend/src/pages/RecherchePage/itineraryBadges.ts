import type { TripItinerary } from '../../lib/trips';

/**
 * Badge affiche sur l'itineraire d'index 0 quand au moins une preference
 * d'accessibilite est cochee (section 2.2 de docs/specs/f3-scoring-
 * perturbations.md, issue #26) - renforce visuellement pourquoi il est
 * premier, sans jamais reveler la valeur de score qui l'a classe ainsi
 * (calcul reste dans ScoringService, backend/src/scoring). Vrai par
 * construction dans ce cas : le tri backend a reellement tenu compte de ces
 * preferences.
 *
 * Sans profil ou sans preference cochee, "adapte a VOS criteres" n'a plus
 * aucun sens (aucun critere n'existe) - BEST_OVERALL_BADGE_LABEL_NO_PREFERENCE
 * s'affiche a la place, et PAS forcement sur l'index 0 (issue #274).
 */
export const BEST_OVERALL_BADGE_LABEL = 'Le plus adapté à vos critères';

/**
 * Repli du badge ci-dessus quand aucune preference d'accessibilite n'est
 * cochee (issue #274). Affiche sur l'itineraire qui minimise REELLEMENT
 * `durationSeconds` parmi les resultats affiches (voir
 * computeItineraryBadges) - jamais suppose en tete de liste : le classement
 * de base (SCORING_WEIGHTS cote backend) penalise aussi les correspondances/
 * la pluie/une perturbation meme sans profil, l'index 0 n'est donc pas
 * toujours le plus rapide en pratique (constate en verification reelle : un
 * trajet a 42 min etait badge "le plus rapide" alors qu'un autre a 32 min
 * existait plus bas dans la liste, correction suite a ce constat).
 */
export const BEST_OVERALL_BADGE_LABEL_NO_PREFERENCE = 'Trajet le plus rapide';

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
 * Un seul badge cible peut s'afficher (section 2.2 : au plus 2 badges sur
 * l'ensemble de la liste, un seul par carte). Si plusieurs preferences
 * ciblees sont cochees simultanement, l'ordre de ce tableau fait office de
 * priorite : on prend le premier critere trouve. `limit_transfers` passe
 * avant `limit_walking_distance`
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
 * Libelle de badge a afficher par index d'itineraire dans la liste deja
 * triee recue de GET /trips - un index absent de cet objet n'affiche aucun
 * badge. AU PLUS UN libelle par carte (issue #169, section 2.2 : "jamais par
 * itineraire individuel") : le type porte cette garantie, ce n'est plus un
 * tableau. Voir RecherchePageResults.tsx (ItineraryCard) pour le rendu.
 */
export type ItineraryBadges = Record<number, string>;

/**
 * Calcule les badges qualitatifs de scoring a afficher sur la liste de
 * resultats (section 2.2 de la spec F3) :
 * - SANS preference d'accessibilite cochee : un seul badge, factuel plutot
 *   que suppose - BEST_OVERALL_BADGE_LABEL_NO_PREFERENCE sur l'itineraire
 *   qui minimise REELLEMENT `durationSeconds` parmi les resultats affiches
 *   (issue #274, correction suite a verification reelle : l'index 0 n'est
 *   PAS toujours le plus rapide, le score de base penalise aussi les
 *   correspondances/la pluie/une perturbation meme sans profil - voir
 *   ScoringService, backend/src/scoring - un trajet a 42 min etait badge
 *   "le plus rapide" alors qu'un autre a 32 min existait plus bas dans la
 *   liste). Jamais suppose en tete de liste.
 * - AVEC au moins une preference cochee : l'itineraire d'index 0 (deja en
 *   tete du tri backend, qui LES a prises en compte) recoit
 *   BEST_OVERALL_BADGE_LABEL - affirmation vraie par construction ici,
 *   contrairement au cas ci-dessus. Si une preference correspond en plus a
 *   un critere cible connu, l'itineraire qui le satisfait le mieux recoit
 *   en plus (ou a la place, si c'est un autre itineraire) le badge dedie a
 *   ce critere.
 *
 * Ne mute jamais le tableau `itineraries` recu, coherent avec la meme regle
 * deja appliquee par ScoringService cote backend. Par construction (et non
 * par verification a posteriori) : au plus un libelle par carte, et au plus
 * 2 sur toute la liste (un badge global sur l'index 0, un badge cible sur un
 * autre index au maximum) UNIQUEMENT quand une preference est cochee - sans
 * preference, un seul badge total (voir ci-dessus). Si le meilleur choix
 * global est aussi celui qui satisfait le mieux le critere cible, seul le
 * badge global s'affiche sur cette carte - il est prioritaire, et il n'y a
 * pas d'autre carte ou poser le badge cible (issue #169).
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

  if (accessibilityPreferences.length === 0) {
    let fastestIndex = 0;
    for (let index = 1; index < itineraries.length; index++) {
      if (
        itineraries[index].durationSeconds <
        itineraries[fastestIndex].durationSeconds
      ) {
        fastestIndex = index;
      }
    }
    badges[fastestIndex] = BEST_OVERALL_BADGE_LABEL_NO_PREFERENCE;
    return badges;
  }

  // Au moins une preference cochee : l'index 0 tient compte de VOS criteres
  // (c'est litteralement ce que le tri backend signifie ici), le badge
  // global reste donc vrai sans avoir besoin de le verifier plus avant.
  badges[0] = BEST_OVERALL_BADGE_LABEL;

  // Si aucun critere cible connu ne correspond aux preferences cochees
  // (ex. seul wheelchair_accessible, un filtre - voir TARGETED_CRITERIA),
  // seul le badge global s'affiche (section 2.2, derniere regle).
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

  // Si le meilleur choix global (index 0) satisfait deja le mieux ce critere,
  // on ne pose PAS le badge cible : le badge global reste seul sur cette
  // carte (prioritaire), et aucune autre carte ne se distingue sur ce
  // critere (issue #169 - un seul badge par carte).
  if (bestIndex === 0) return badges;

  badges[bestIndex] = criterion.badgeLabel;
  return badges;
}
