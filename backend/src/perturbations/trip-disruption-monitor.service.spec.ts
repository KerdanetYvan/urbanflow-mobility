import type { RealtimeDisruption } from '../gtfs-realtime/interfaces/realtime-disruption.interface';
import type { FollowedTrip } from '../trips/following/followed-trip.entity';
import { TripDisruptionMonitorService } from './trip-disruption-monitor.service';

function buildFollowedTrip(
  overrides: Partial<FollowedTrip> = {},
): FollowedTrip {
  return {
    id: 'followed-1',
    userId: 'user-1',
    originLat: 48.11,
    originLon: -1.68,
    originLabel: 'République',
    destinationLat: 48.12,
    destinationLon: -1.67,
    destinationLabel: 'Gare',
    segments: [{ mode: 'BUS', routeId: 'ligne-a', tripId: 'course-1' }],
    transportModes: null,
    endTime: new Date('2026-01-15T09:00:00.000Z'),
    lastNotifiedDisruptionSignature: null,
    createdAt: new Date(),
    ...overrides,
  } as FollowedTrip;
}

describe('TripDisruptionMonitorService', () => {
  let findAllActive: jest.Mock;
  let findDisruptions: jest.Mock;
  let search: jest.Mock;
  let notifyUser: jest.Mock;
  let recordNotifiedDisruption: jest.Mock;
  let service: TripDisruptionMonitorService;

  beforeEach(() => {
    findAllActive = jest.fn().mockResolvedValue([]);
    findDisruptions = jest.fn().mockReturnValue([]);
    search = jest.fn().mockResolvedValue({ itineraries: [] });
    notifyUser = jest.fn().mockResolvedValue(undefined);
    recordNotifiedDisruption = jest.fn().mockResolvedValue(undefined);

    service = new TripDisruptionMonitorService(
      { findAllActive, recordNotifiedDisruption } as never,
      { findDisruptions } as never,
      { search } as never,
      { notifyUser } as never,
    );
  });

  it("ne fait rien tant qu'aucun suivi n'est actif", async () => {
    findAllActive.mockResolvedValue([]);

    await service.checkFollowedTrips();

    expect(search).not.toHaveBeenCalled();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("ne declenche rien pour un suivi dont aucun segment n'est perturbe", async () => {
    findAllActive.mockResolvedValue([buildFollowedTrip()]);
    findDisruptions.mockReturnValue([]);

    await service.checkFollowedTrips();

    expect(search).not.toHaveBeenCalled();
    expect(notifyUser).not.toHaveBeenCalled();
    expect(recordNotifiedDisruption).not.toHaveBeenCalled();
  });

  it(
    'declenche recalcul + notification quand un segment du suivi est ' +
      'touche par une perturbation, et enregistre la signature',
    async () => {
      const followedTrip = buildFollowedTrip();
      findAllActive.mockResolvedValue([followedTrip]);
      const disruption: RealtimeDisruption = {
        kind: 'alert',
        routeId: 'ligne-a',
        headerText: 'Travaux sur la ligne',
      };
      findDisruptions.mockImplementation(({ routeId }: { routeId?: string }) =>
        routeId === 'ligne-a' ? [disruption] : [],
      );

      await service.checkFollowedTrips();

      expect(search).toHaveBeenCalledWith(
        {
          originLat: 48.11,
          originLon: -1.68,
          destinationLat: 48.12,
          destinationLon: -1.67,
          transportModes: undefined,
        },
        'user-1',
      );
      expect(notifyUser).toHaveBeenCalledWith('user-1', {
        title: 'Perturbation sur votre trajet',
        body: 'Travaux sur la ligne',
      });
      expect(recordNotifiedDisruption).toHaveBeenCalledWith(
        'followed-1',
        'alert|ligne-a|||Travaux sur la ligne',
      );
    },
  );

  it('transmet les transportModes du suivi au recalcul quand ils sont renseignes', async () => {
    const followedTrip = buildFollowedTrip({
      transportModes: ['bus'] as never,
    });
    findAllActive.mockResolvedValue([followedTrip]);
    findDisruptions.mockReturnValue([
      { kind: 'cancellation', tripId: 'course-1' },
    ]);

    await service.checkFollowedTrips();

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ transportModes: ['bus'] }),
      'user-1',
    );
  });

  it(
    'ne renotifie pas pour la MEME perturbation (signature identique a la ' +
      'derniere notifiee) - anti-spam',
    async () => {
      const disruption: RealtimeDisruption = {
        kind: 'alert',
        routeId: 'ligne-a',
        headerText: 'Travaux',
      };
      const followedTrip = buildFollowedTrip({
        lastNotifiedDisruptionSignature: 'alert|ligne-a|||Travaux',
      });
      findAllActive.mockResolvedValue([followedTrip]);
      findDisruptions.mockReturnValue([disruption]);

      await service.checkFollowedTrips();

      expect(search).not.toHaveBeenCalled();
      expect(notifyUser).not.toHaveBeenCalled();
    },
  );

  it('renotifie quand la perturbation a change (signature differente)', async () => {
    const followedTrip = buildFollowedTrip({
      lastNotifiedDisruptionSignature: 'alert|ligne-a|||Ancienne alerte',
    });
    findAllActive.mockResolvedValue([followedTrip]);
    findDisruptions.mockReturnValue([
      { kind: 'alert', routeId: 'ligne-a', headerText: 'Nouvelle alerte' },
    ]);

    await service.checkFollowedTrips();

    expect(notifyUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ body: 'Nouvelle alerte' }),
    );
  });

  it("verifie chaque segment du suivi jusqu'a trouver une perturbation", async () => {
    const followedTrip = buildFollowedTrip({
      segments: [
        { mode: 'WALK' },
        { mode: 'BUS', routeId: 'ligne-a', tripId: 'course-1' },
        { mode: 'BUS', routeId: 'ligne-b', tripId: 'course-2' },
      ],
    });
    findAllActive.mockResolvedValue([followedTrip]);
    findDisruptions.mockImplementation(({ routeId }: { routeId?: string }) =>
      routeId === 'ligne-b'
        ? [{ kind: 'cancellation', routeId: 'ligne-b' }]
        : [],
    );

    await service.checkFollowedTrips();

    expect(notifyUser).toHaveBeenCalled();
  });

  it.each<[RealtimeDisruption, string]>([
    [{ kind: 'alert' }, 'Une perturbation affecte votre trajet.'],
    [
      { kind: 'cancellation', tripId: 'course-1' },
      'Une course de votre trajet est annulée - un nouvel itinéraire est disponible.',
    ],
    [
      { kind: 'skipped_stop', stopId: 'arret-1' },
      'Un arrêt de votre trajet est supprimé - un nouvel itinéraire est disponible.',
    ],
  ])(
    'formule un corps de notification adapte a %o',
    async (disruption, expectedBody) => {
      const followedTrip = buildFollowedTrip();
      findAllActive.mockResolvedValue([followedTrip]);
      findDisruptions.mockReturnValue([disruption]);

      await service.checkFollowedTrips();

      expect(notifyUser).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ body: expectedBody }),
      );
    },
  );

  it('traite plusieurs suivis independamment', async () => {
    const trip1 = buildFollowedTrip({ id: 'followed-1', userId: 'user-1' });
    const trip2 = buildFollowedTrip({
      id: 'followed-2',
      userId: 'user-2',
      segments: [{ mode: 'BUS', routeId: 'ligne-c' }],
    });
    findAllActive.mockResolvedValue([trip1, trip2]);
    findDisruptions.mockImplementation(({ routeId }: { routeId?: string }) =>
      routeId === 'ligne-c'
        ? [{ kind: 'cancellation', routeId: 'ligne-c' }]
        : [],
    );

    await service.checkFollowedTrips();

    // trip1 n'a pas de perturbation (routeId 'ligne-a' non couvert par le
    // mock ci-dessus) - seul trip2 declenche une notification.
    expect(notifyUser).toHaveBeenCalledTimes(1);
    expect(notifyUser).toHaveBeenCalledWith('user-2', expect.anything());
  });
});
