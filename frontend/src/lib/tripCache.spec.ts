import type { PlaceSuggestion } from './places';
import { getCachedTrip, saveTripToCache } from './tripCache';
import type { TripSearchResult } from './trips';

const ORIGIN: PlaceSuggestion = { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 };
const DESTINATION: PlaceSuggestion = { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 };
const AUTRE_DESTINATION: PlaceSuggestion = { label: 'Université', lat: 45.78, lon: 4.87 };

const RESULT: TripSearchResult = {
  itineraries: [
    { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
  ],
};

describe('tripCache (issue #10, mode dégradé)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("ne renvoie rien tant qu'aucun trajet n'a ete mis en cache", () => {
    expect(getCachedTrip(ORIGIN, DESTINATION)).toBeNull();
  });

  it('retrouve un trajet mis en cache par origine/destination exacte (coordonnees)', () => {
    saveTripToCache(ORIGIN, DESTINATION, RESULT);

    const cached = getCachedTrip(ORIGIN, DESTINATION);

    expect(cached).not.toBeNull();
    expect(cached?.result).toEqual(RESULT);
    expect(cached?.origin).toEqual(ORIGIN);
    expect(cached?.destination).toEqual(DESTINATION);
  });

  it(
    'reconnait le meme trajet meme si le libelle differe (reformulation du ' +
      'geocodeur) - seules les coordonnees comptent',
    () => {
      saveTripToCache(ORIGIN, DESTINATION, RESULT);

      const cached = getCachedTrip(
        { ...ORIGIN, label: 'Gare' },
        { ...DESTINATION, label: 'Mairie' },
      );

      expect(cached).not.toBeNull();
    },
  );

  it("ne retrouve rien pour un couple origine/destination different", () => {
    saveTripToCache(ORIGIN, DESTINATION, RESULT);

    expect(getCachedTrip(ORIGIN, AUTRE_DESTINATION)).toBeNull();
  });

  it('une recherche repetee sur le meme trajet met a jour l\'entree existante (pas de doublon)', () => {
    saveTripToCache(ORIGIN, DESTINATION, RESULT);
    const misAJour: TripSearchResult = {
      itineraries: [
        { startTime: 't2', endTime: 't3', durationSeconds: 900, transfers: 1, segments: [] },
      ],
    };
    saveTripToCache(ORIGIN, DESTINATION, misAJour);

    expect(getCachedTrip(ORIGIN, DESTINATION)?.result).toEqual(misAJour);
  });

  it('plafonne a 5 entrees, la plus ancienne cede la place', () => {
    const destinations = Array.from({ length: 6 }, (_, i) => ({
      label: `Destination ${i}`,
      lat: 45.7 + i,
      lon: 4.8 + i,
    }));

    destinations.forEach((destination) => {
      saveTripToCache(ORIGIN, destination, RESULT);
    });

    // La toute premiere destination (plus ancienne) a ete evincee.
    expect(getCachedTrip(ORIGIN, destinations[0])).toBeNull();
    // Les 5 plus recentes sont toujours la.
    for (let i = 1; i < 6; i += 1) {
      expect(getCachedTrip(ORIGIN, destinations[i])).not.toBeNull();
    }
  });

  it('purge une entree expiree (au-dela de 24h) au lieu de la renvoyer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'));
    saveTripToCache(ORIGIN, DESTINATION, RESULT);

    vi.setSystemTime(new Date('2026-01-02T08:00:01.000Z')); // 24h + 1s plus tard

    expect(getCachedTrip(ORIGIN, DESTINATION)).toBeNull();
  });

  it('ne purge pas une entree encore valide (juste sous 24h)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T08:00:00.000Z'));
    saveTripToCache(ORIGIN, DESTINATION, RESULT);

    vi.setSystemTime(new Date('2026-01-02T07:59:00.000Z')); // 23h59 plus tard

    expect(getCachedTrip(ORIGIN, DESTINATION)).not.toBeNull();
  });

  it("degrade silencieusement (pas d'exception) si localStorage contient un JSON corrompu", () => {
    localStorage.setItem('urbanflow.tripCache.v1', '{not valid json');

    expect(getCachedTrip(ORIGIN, DESTINATION)).toBeNull();
    expect(() => saveTripToCache(ORIGIN, DESTINATION, RESULT)).not.toThrow();
  });
});
