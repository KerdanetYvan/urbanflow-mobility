import type { TripItinerary, TripSegment } from '../../lib/trips';
import { BEST_OVERALL_BADGE_LABEL, computeItineraryBadges } from './itineraryBadges';

/** Segment WALK minimal, seul le champ distanceMeters compte pour ces tests. */
function walkSegment(distanceMeters: number): TripSegment {
  return {
    mode: 'WALK',
    startTime: '2026-08-12T08:00:00.000Z',
    endTime: '2026-08-12T08:05:00.000Z',
    durationSeconds: 300,
    distanceMeters,
    from: { name: 'A', lat: 0, lon: 0 },
    to: { name: 'B', lat: 0, lon: 0 },
    geometry: [
      { lat: 0, lon: 0 },
      { lat: 0, lon: 0 },
    ],
  };
}

/** Itineraire minimal pour les tests de badges - seuls transfers/segments comptent. */
function itinerary(overrides: Partial<TripItinerary> = {}): TripItinerary {
  return {
    startTime: '2026-08-12T08:00:00.000Z',
    endTime: '2026-08-12T08:30:00.000Z',
    durationSeconds: 1800,
    transfers: 0,
    segments: [],
    ...overrides,
  };
}

describe('computeItineraryBadges', () => {
  it("attribue uniquement le badge global au premier itineraire quand aucune preference n'est prioritaire (profil incomplet ou recherche anonyme)", () => {
    const itineraries = [itinerary({ transfers: 1 }), itinerary({ transfers: 0 })];

    const badges = computeItineraryBadges(itineraries, []);

    expect(badges).toEqual({ 0: [BEST_OVERALL_BADGE_LABEL] });
  });

  it("ajoute un badge cible sur l'itineraire ayant le moins de correspondances quand limit_transfers est prioritaire, meme si ce n'est pas le premier", () => {
    const itineraries = [
      itinerary({ transfers: 2 }), // premier de la liste = meilleur choix global
      itinerary({ transfers: 0 }), // le moins de correspondances
      itinerary({ transfers: 1 }),
    ];

    const badges = computeItineraryBadges(itineraries, ['limit_transfers']);

    expect(badges[0]).toEqual([BEST_OVERALL_BADGE_LABEL]);
    expect(badges[1]).toEqual(['Le moins de correspondances']);
    expect(badges[2]).toBeUndefined();
  });

  it('ajoute un badge cible sur la distance de marche cumulee la plus faible quand limit_walking_distance est prioritaire', () => {
    const itineraries = [
      itinerary({ segments: [walkSegment(500)] }),
      itinerary({ segments: [walkSegment(100), walkSegment(50)] }),
    ];

    const badges = computeItineraryBadges(itineraries, ['limit_walking_distance']);

    expect(badges[1]).toEqual(['Le moins de marche à pied']);
  });

  it('ne retient que limit_transfers quand plusieurs preferences ciblees sont cochees simultanement (priorite au poids scoring le plus eleve)', () => {
    const itineraries = [
      itinerary({ transfers: 2, segments: [walkSegment(1000)] }),
      itinerary({ transfers: 0, segments: [walkSegment(1000)] }), // meilleur sur limit_transfers
      itinerary({ transfers: 2, segments: [walkSegment(10)] }), // meilleur sur limit_walking_distance
    ];

    const badges = computeItineraryBadges(itineraries, [
      'limit_walking_distance',
      'limit_transfers',
    ]);

    expect(badges[1]).toEqual(['Le moins de correspondances']);
    expect(badges[2]).toBeUndefined();
  });

  it("n'ajoute aucun badge cible pour wheelchair_accessible (filtre dur OTP, pas un critere classant)", () => {
    const itineraries = [itinerary({ transfers: 3 }), itinerary({ transfers: 0 })];

    const badges = computeItineraryBadges(itineraries, ['wheelchair_accessible']);

    expect(badges).toEqual({ 0: [BEST_OVERALL_BADGE_LABEL] });
  });

  it('cumule les deux badges sur le meme itineraire quand le meilleur choix global satisfait aussi le mieux le critere cible', () => {
    const itineraries = [itinerary({ transfers: 0 }), itinerary({ transfers: 3 })];

    const badges = computeItineraryBadges(itineraries, ['limit_transfers']);

    expect(badges).toEqual({ 0: [BEST_OVERALL_BADGE_LABEL, 'Le moins de correspondances'] });
  });

  it('ne produit jamais plus de 2 badges au total sur toute la liste', () => {
    const itineraries = [
      itinerary({ transfers: 3 }),
      itinerary({ transfers: 2 }),
      itinerary({ transfers: 1 }),
      itinerary({ transfers: 0 }),
    ];

    const badges = computeItineraryBadges(itineraries, ['limit_transfers']);

    expect(Object.values(badges).flat().length).toBeLessThanOrEqual(2);
  });

  it('ne renvoie jamais de libelle contenant une valeur chiffree', () => {
    const itineraries = [itinerary({ transfers: 2 }), itinerary({ transfers: 0 })];

    const badges = computeItineraryBadges(itineraries, ['limit_transfers']);

    for (const label of Object.values(badges).flat()) {
      expect(label).not.toMatch(/\d/);
    }
  });

  it('renvoie un objet vide pour une liste vide, sans erreur', () => {
    expect(computeItineraryBadges([], ['limit_transfers'])).toEqual({});
  });
});
