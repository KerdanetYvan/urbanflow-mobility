import { AccessibilityPreference } from '../profiles/accessibility-preference.enum';
import { MobilityProfile } from '../profiles/mobility-profile.entity';
import { TransportMode } from '../profiles/transport-mode.enum';
import type {
  TripItinerary,
  TripSegment,
} from '../trips/dto/trip-itinerary.dto';
import type { CurrentWeather } from '../weather/weather.service';
import { ScoringService } from './scoring.service';

const PLACE = { name: 'x', lat: 0, lon: 0 };

function buildSegment(overrides: Partial<TripSegment>): TripSegment {
  return {
    mode: 'WALK',
    startTime: '2026-01-01T08:00:00.000Z',
    endTime: '2026-01-01T08:10:00.000Z',
    durationSeconds: 600,
    distanceMeters: 0,
    from: PLACE,
    to: PLACE,
    geometry: [PLACE, PLACE],
    ...overrides,
  };
}

function buildItinerary(overrides: Partial<TripItinerary> = {}): TripItinerary {
  return {
    startTime: '2026-01-01T08:00:00.000Z',
    endTime: '2026-01-01T08:20:00.000Z',
    durationSeconds: 1200,
    transfers: 0,
    segments: [buildSegment({})],
    ...overrides,
  };
}

function buildProfile(
  overrides: Partial<MobilityProfile> = {},
): MobilityProfile {
  // Double assertion : seuls preferredTransportModes/accessibilityPreferences
  // sont lus par ScoringService, pas besoin de peupler id/userId/user/dates.
  return {
    preferredTransportModes: [],
    accessibilityPreferences: [],
    ...overrides,
  } as unknown as MobilityProfile;
}

describe('ScoringService', () => {
  let service: ScoringService;
  let weatherService: { getCurrentConditions: jest.Mock };
  let gtfsRealtimeCache: { findDisruptions: jest.Mock };

  beforeEach(() => {
    // Pas de pluie par defaut (voir CurrentWeather) : les tests qui ne
    // portent pas sur le critere meteo (issue #17) restent inchanges par
    // rapport a avant son introduction.
    weatherService = {
      getCurrentConditions: jest.fn().mockResolvedValue(null),
    };
    // Aucune perturbation par defaut (issue #18) : les tests qui ne portent
    // pas sur ce critere restent inchanges par rapport a avant son
    // introduction.
    gtfsRealtimeCache = { findDisruptions: jest.fn().mockReturnValue([]) };
    service = new ScoringService(
      weatherService as never,
      gtfsRealtimeCache as never,
    );
  });

  it("sans profil ni pluie : l'itineraire le plus court gagne", async () => {
    const court = buildItinerary({ durationSeconds: 600, transfers: 0 });
    const long = buildItinerary({ durationSeconds: 1800, transfers: 0 });

    await expect(service.rank([long, court], null)).resolves.toEqual([
      court,
      long,
    ]);
  });

  it('sans profil : a duree egale, moins de correspondances gagne (poids de base)', async () => {
    const uneCorrespondance = buildItinerary({
      durationSeconds: 900,
      transfers: 1,
    });
    const zeroCorrespondance = buildItinerary({
      durationSeconds: 900,
      transfers: 0,
    });

    await expect(
      service.rank([uneCorrespondance, zeroCorrespondance], null),
    ).resolves.toEqual([zeroCorrespondance, uneCorrespondance]);
  });

  it(
    'avec LIMIT_TRANSFERS : un itineraire plus long mais avec moins de ' +
      'correspondances passe devant un itineraire plus court mais avec ' +
      'plus de correspondances',
    async () => {
      // Sans profil, A (plus court, 2 correspondances) devrait gagner sur B
      // (plus long, 0 correspondance) - voir l'assertion "sans profil"
      // ci-dessous, qui documente ce comportement de reference.
      const plusCourtPlusDeCorrespondances = buildItinerary({
        durationSeconds: 600,
        transfers: 2,
      });
      const plusLongMoinsDeCorrespondances = buildItinerary({
        durationSeconds: 900,
        transfers: 0,
      });

      await expect(
        service.rank(
          [plusCourtPlusDeCorrespondances, plusLongMoinsDeCorrespondances],
          null,
        ),
      ).resolves.toEqual([
        plusCourtPlusDeCorrespondances,
        plusLongMoinsDeCorrespondances,
      ]);

      const profil = buildProfile({
        accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
      });

      await expect(
        service.rank(
          [plusCourtPlusDeCorrespondances, plusLongMoinsDeCorrespondances],
          profil,
        ),
      ).resolves.toEqual([
        plusLongMoinsDeCorrespondances,
        plusCourtPlusDeCorrespondances,
      ]);
    },
  );

  it(
    'avec LIMIT_WALKING_DISTANCE : un itineraire avec moins de marche passe ' +
      'devant un itineraire legerement plus rapide mais plus marche',
    async () => {
      const rapideMaisBeaucoupDeMarche = buildItinerary({
        durationSeconds: 600,
        segments: [buildSegment({ mode: 'WALK', distanceMeters: 2000 })],
      });
      const unPeuPlusLentMaisPeuDeMarche = buildItinerary({
        durationSeconds: 700,
        segments: [
          buildSegment({ mode: 'WALK', distanceMeters: 100 }),
          buildSegment({ mode: 'BUS', distanceMeters: 3000 }),
        ],
      });

      // Sans la preference, le trajet le plus rapide gagne malgre la marche.
      await expect(
        service.rank(
          [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
          null,
        ),
      ).resolves.toEqual([
        rapideMaisBeaucoupDeMarche,
        unPeuPlusLentMaisPeuDeMarche,
      ]);

      const profil = buildProfile({
        accessibilityPreferences: [
          AccessibilityPreference.LIMIT_WALKING_DISTANCE,
        ],
      });

      await expect(
        service.rank(
          [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
          profil,
        ),
      ).resolves.toEqual([
        unPeuPlusLentMaisPeuDeMarche,
        rapideMaisBeaucoupDeMarche,
      ]);
    },
  );

  it(
    'avec preferredTransportModes contenant METRO : un itineraire avec un ' +
      'segment SUBWAY passe devant un itineraire equivalent en BUS',
    async () => {
      const enBus = buildItinerary({
        durationSeconds: 900,
        segments: [buildSegment({ mode: 'BUS' })],
      });
      const enMetro = buildItinerary({
        durationSeconds: 900,
        segments: [buildSegment({ mode: 'SUBWAY' })],
      });

      // Sans profil, aucun des deux modes n'est favorise : egalite (ordre
      // d'entree conserve par le tri stable).
      await expect(service.rank([enBus, enMetro], null)).resolves.toEqual([
        enBus,
        enMetro,
      ]);

      const profil = buildProfile({
        preferredTransportModes: [TransportMode.METRO],
      });

      await expect(service.rank([enBus, enMetro], profil)).resolves.toEqual([
        enMetro,
        enBus,
      ]);
    },
  );

  it('ne mute ni le tableau ni les itineraires recus', async () => {
    const original = [
      buildItinerary({ durationSeconds: 900 }),
      buildItinerary({ durationSeconds: 600 }),
    ];
    const originalCopy = original.map((itinerary) => ({ ...itinerary }));

    const result = await service.rank(original, null);

    expect(original).toEqual(originalCopy);
    expect(result).not.toBe(original);
  });

  describe('critere meteo (issue #17)', () => {
    function pluie(precipitationMm: number): CurrentWeather {
      return { precipitationMm };
    }

    it(
      'sous le seuil de pluie forte, le trajet le plus rapide gagne malgre ' +
        'la marche (comme sans pluie)',
      async () => {
        weatherService.getCurrentConditions.mockResolvedValue(pluie(1));

        const rapideMaisBeaucoupDeMarche = buildItinerary({
          durationSeconds: 600,
          segments: [buildSegment({ mode: 'WALK', distanceMeters: 2000 })],
        });
        const unPeuPlusLentMaisPeuDeMarche = buildItinerary({
          durationSeconds: 700,
          segments: [buildSegment({ mode: 'WALK', distanceMeters: 100 })],
        });

        await expect(
          service.rank(
            [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
            null,
          ),
        ).resolves.toEqual([
          rapideMaisBeaucoupDeMarche,
          unPeuPlusLentMaisPeuDeMarche,
        ]);
      },
    );

    it(
      'en cas de pluie forte, un itineraire avec moins de marche passe ' +
        'devant un itineraire legerement plus rapide mais plus marche - ' +
        'meme sans profil (critere de base, pas une preference)',
      async () => {
        weatherService.getCurrentConditions.mockResolvedValue(pluie(5));

        const rapideMaisBeaucoupDeMarche = buildItinerary({
          durationSeconds: 600,
          segments: [buildSegment({ mode: 'WALK', distanceMeters: 2000 })],
        });
        const unPeuPlusLentMaisPeuDeMarche = buildItinerary({
          durationSeconds: 700,
          segments: [buildSegment({ mode: 'WALK', distanceMeters: 100 })],
        });

        await expect(
          service.rank(
            [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
            null,
          ),
        ).resolves.toEqual([
          unPeuPlusLentMaisPeuDeMarche,
          rapideMaisBeaucoupDeMarche,
        ]);
      },
    );

    it('meteo indisponible (null) : pas de malus, pas de crash', async () => {
      weatherService.getCurrentConditions.mockResolvedValue(null);

      const rapideMaisBeaucoupDeMarche = buildItinerary({
        durationSeconds: 600,
        segments: [buildSegment({ mode: 'WALK', distanceMeters: 2000 })],
      });
      const unPeuPlusLentMaisPeuDeMarche = buildItinerary({
        durationSeconds: 700,
        segments: [buildSegment({ mode: 'WALK', distanceMeters: 100 })],
      });

      await expect(
        service.rank(
          [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
          null,
        ),
      ).resolves.toEqual([
        rapideMaisBeaucoupDeMarche,
        unPeuPlusLentMaisPeuDeMarche,
      ]);
    });
  });

  describe('critere perturbation GTFS-Realtime (issue #18)', () => {
    it(
      'un itineraire dont un segment est perturbe passe derriere une ' +
        'alternative propre de duree proche',
      async () => {
        // routeId sert d'identifiant stable pour reconnaitre chaque
        // itineraire dans le resultat : rank() renvoie desormais des copies
        // (jamais les objets recus, voir sa docstring), la comparaison par
        // reference (toBe) ne fonctionne donc plus ici.
        const perturbe = buildItinerary({
          durationSeconds: 600,
          segments: [buildSegment({ mode: 'BUS', routeId: 'ligne-a' })],
        });
        const propre = buildItinerary({
          durationSeconds: 610,
          segments: [buildSegment({ mode: 'BUS', routeId: 'ligne-b' })],
        });
        gtfsRealtimeCache.findDisruptions.mockImplementation(
          ({ routeId }: { routeId?: string }) =>
            routeId === 'ligne-a' ? [{ kind: 'alert' }] : [],
        );

        const [first] = await service.rank([perturbe, propre], null);

        // Le trajet perturbe etait pourtant le plus rapide (10s de moins) -
        // la penalite (15 points, equivalent 15 min) l'emporte largement.
        expect(first.segments[0].routeId).toBe('ligne-b');
      },
    );

    it("marque disrupted: true l'itineraire touche, absent (pas false) sur l'autre", async () => {
      const perturbe = buildItinerary({
        segments: [buildSegment({ mode: 'BUS', tripId: 'course-1' })],
      });
      const propre = buildItinerary({
        segments: [buildSegment({ mode: 'BUS', tripId: 'course-2' })],
      });
      gtfsRealtimeCache.findDisruptions.mockImplementation(
        ({ tripId }: { tripId?: string }) =>
          tripId === 'course-1' ? [{ kind: 'cancellation' }] : [],
      );

      const result = await service.rank([perturbe, propre], null);

      const marque = result.find((i) => i.segments[0].tripId === 'course-1');
      const nonMarque = result.find((i) => i.segments[0].tripId === 'course-2');
      expect(marque?.disrupted).toBe(true);
      expect(nonMarque?.disrupted).toBeUndefined();
    });

    it("transmet routeId ET tripId du segment a findDisruptions (recoupement par l'un ou l'autre)", async () => {
      const itinerary = buildItinerary({
        segments: [
          buildSegment({ mode: 'BUS', routeId: 'ligne-x', tripId: 'course-x' }),
        ],
      });

      await service.rank([itinerary], null);

      expect(gtfsRealtimeCache.findDisruptions).toHaveBeenCalledWith({
        routeId: 'ligne-x',
        tripId: 'course-x',
      });
    });

    it('aucune perturbation : classement inchange, aucun itineraire marque disrupted', async () => {
      const court = buildItinerary({ durationSeconds: 600 });
      const long = buildItinerary({ durationSeconds: 900 });

      const result = await service.rank([long, court], null);

      expect(result).toEqual([court, long]);
      expect(result.every((i) => i.disrupted === undefined)).toBe(true);
    });
  });
});
