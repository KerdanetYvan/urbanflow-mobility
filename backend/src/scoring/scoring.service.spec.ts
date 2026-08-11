import { AccessibilityPreference } from '../profiles/accessibility-preference.enum';
import { MobilityProfile } from '../profiles/mobility-profile.entity';
import { TransportMode } from '../profiles/transport-mode.enum';
import type {
  TripItinerary,
  TripSegment,
} from '../trips/dto/trip-itinerary.dto';
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
  const service = new ScoringService();

  it("sans profil : l'itineraire le plus court gagne", () => {
    const court = buildItinerary({ durationSeconds: 600, transfers: 0 });
    const long = buildItinerary({ durationSeconds: 1800, transfers: 0 });

    expect(service.rank([long, court], null)).toEqual([court, long]);
  });

  it('sans profil : a duree egale, moins de correspondances gagne (poids de base)', () => {
    const uneCorrespondance = buildItinerary({
      durationSeconds: 900,
      transfers: 1,
    });
    const zeroCorrespondance = buildItinerary({
      durationSeconds: 900,
      transfers: 0,
    });

    expect(service.rank([uneCorrespondance, zeroCorrespondance], null)).toEqual(
      [zeroCorrespondance, uneCorrespondance],
    );
  });

  it(
    'avec LIMIT_TRANSFERS : un itineraire plus long mais avec moins de ' +
      'correspondances passe devant un itineraire plus court mais avec ' +
      'plus de correspondances',
    () => {
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

      expect(
        service.rank(
          [plusCourtPlusDeCorrespondances, plusLongMoinsDeCorrespondances],
          null,
        ),
      ).toEqual([
        plusCourtPlusDeCorrespondances,
        plusLongMoinsDeCorrespondances,
      ]);

      const profil = buildProfile({
        accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
      });

      expect(
        service.rank(
          [plusCourtPlusDeCorrespondances, plusLongMoinsDeCorrespondances],
          profil,
        ),
      ).toEqual([
        plusLongMoinsDeCorrespondances,
        plusCourtPlusDeCorrespondances,
      ]);
    },
  );

  it(
    'avec LIMIT_WALKING_DISTANCE : un itineraire avec moins de marche passe ' +
      'devant un itineraire legerement plus rapide mais plus marche',
    () => {
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
      expect(
        service.rank(
          [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
          null,
        ),
      ).toEqual([rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche]);

      const profil = buildProfile({
        accessibilityPreferences: [
          AccessibilityPreference.LIMIT_WALKING_DISTANCE,
        ],
      });

      expect(
        service.rank(
          [rapideMaisBeaucoupDeMarche, unPeuPlusLentMaisPeuDeMarche],
          profil,
        ),
      ).toEqual([unPeuPlusLentMaisPeuDeMarche, rapideMaisBeaucoupDeMarche]);
    },
  );

  it(
    'avec preferredTransportModes contenant METRO : un itineraire avec un ' +
      'segment SUBWAY passe devant un itineraire equivalent en BUS',
    () => {
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
      expect(service.rank([enBus, enMetro], null)).toEqual([enBus, enMetro]);

      const profil = buildProfile({
        preferredTransportModes: [TransportMode.METRO],
      });

      expect(service.rank([enBus, enMetro], profil)).toEqual([enMetro, enBus]);
    },
  );

  it('ne mute ni le tableau ni les itineraires recus', () => {
    const original = [
      buildItinerary({ durationSeconds: 900 }),
      buildItinerary({ durationSeconds: 600 }),
    ];
    const originalCopy = original.map((itinerary) => ({ ...itinerary }));

    const result = service.rank(original, null);

    expect(original).toEqual(originalCopy);
    expect(result).not.toBe(original);
  });
});
