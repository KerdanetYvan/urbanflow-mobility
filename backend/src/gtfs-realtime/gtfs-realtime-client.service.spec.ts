import GtfsRealtimeBindings from 'gtfs-realtime-bindings';
import type { transit_realtime } from 'gtfs-realtime-bindings';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';

const { FeedMessage } = GtfsRealtimeBindings.transit_realtime;
const URL_TRIP_UPDATES = 'https://operateur.example/gtfs-rt/trip-updates';
const URL_ALERTS = 'https://operateur.example/gtfs-rt/alerts';

/** Encode un FeedMessage GTFS-Realtime reel (round-trip complet, pas de bytes bricolés a la main) et l'expose comme reponse fetch binaire. */
function feedResponse(entities: transit_realtime.IFeedEntity[]): Response {
  const message = FeedMessage.encode({
    header: { gtfsRealtimeVersion: '2.0' },
    entity: entities,
  }).finish();
  return {
    ok: true,
    status: 200,
    arrayBuffer: () =>
      Promise.resolve(
        message.buffer.slice(
          message.byteOffset,
          message.byteOffset + message.byteLength,
        ),
      ),
  } as Response;
}

describe('GtfsRealtimeClientService', () => {
  let service: GtfsRealtimeClientService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    service = new GtfsRealtimeClientService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  describe('fetchTripUpdateDisruptions', () => {
    it('detecte une course annulee (trip.scheduleRelationship = CANCELED)', async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: '1',
            tripUpdate: {
              trip: {
                tripId: 'course-1',
                routeId: 'ligne-a',
                scheduleRelationship:
                  GtfsRealtimeBindings.transit_realtime.TripDescriptor
                    .ScheduleRelationship.CANCELED,
              },
            },
          },
        ]),
      );

      const result = await service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES);

      expect(result).toEqual([
        { kind: 'cancellation', tripId: 'course-1', routeId: 'ligne-a' },
      ]);
    });

    it('detecte un arret saute sur une course par ailleurs programmee (stopTimeUpdate.scheduleRelationship = SKIPPED)', async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: '1',
            tripUpdate: {
              trip: { tripId: 'course-2', routeId: 'ligne-b' },
              stopTimeUpdate: [
                {
                  stopId: 'arret-3',
                  scheduleRelationship:
                    GtfsRealtimeBindings.transit_realtime.TripUpdate
                      .StopTimeUpdate.ScheduleRelationship.SKIPPED,
                },
                {
                  stopId: 'arret-4',
                  scheduleRelationship:
                    GtfsRealtimeBindings.transit_realtime.TripUpdate
                      .StopTimeUpdate.ScheduleRelationship.SCHEDULED,
                },
              ],
            },
          },
        ]),
      );

      const result = await service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES);

      expect(result).toEqual([
        {
          kind: 'skipped_stop',
          tripId: 'course-2',
          routeId: 'ligne-b',
          stopId: 'arret-3',
        },
      ]);
    });

    it("n'inspecte pas les arrets d'une course deja annulee en bloc (une seule entree suffit)", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: '1',
            tripUpdate: {
              trip: {
                tripId: 'course-3',
                scheduleRelationship:
                  GtfsRealtimeBindings.transit_realtime.TripDescriptor
                    .ScheduleRelationship.CANCELED,
              },
              stopTimeUpdate: [
                {
                  stopId: 'arret-1',
                  scheduleRelationship:
                    GtfsRealtimeBindings.transit_realtime.TripUpdate
                      .StopTimeUpdate.ScheduleRelationship.SKIPPED,
                },
              ],
            },
          },
        ]),
      );

      const result = await service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES);

      expect(result).toEqual([{ kind: 'cancellation', tripId: 'course-3' }]);
    });

    it('renvoie un tableau vide (pas null) pour une course entierement programmee - "0 perturbation" est un resultat valide', async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          { id: '1', tripUpdate: { trip: { tripId: 'course-ok' } } },
        ]),
      );

      const result = await service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES);

      expect(result).toEqual([]);
    });

    it('renvoie null (pas []) si le flux est injoignable - distingue panne et absence de perturbation', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES),
      ).resolves.toBeNull();
    });

    it('renvoie null si le flux repond en erreur HTTP', async () => {
      fetchSpy.mockResolvedValue({ ok: false, status: 503 } as Response);

      await expect(
        service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES),
      ).resolves.toBeNull();
    });

    it('renvoie null si le contenu ne se decode pas comme un FeedMessage valide', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () =>
          Promise.resolve(new Uint8Array([0xff, 0xff, 0xff]).buffer),
      } as Response);

      await expect(
        service.fetchTripUpdateDisruptions(URL_TRIP_UPDATES),
      ).resolves.toBeNull();
    });
  });

  describe('fetchAlertDisruptions', () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    it('genere une entree par entite informee, avec le texte francais', async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-1',
            alert: {
              informedEntity: [
                { routeId: 'ligne-a' },
                { stopId: 'arret-9', trip: { tripId: 'course-9' } },
              ],
              headerText: {
                translation: [
                  { text: 'Delay - construction works', language: 'en' },
                  { text: 'Retard - travaux en cours', language: 'fr' },
                ],
              },
            },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);

      expect(result).toEqual([
        {
          kind: 'alert',
          routeId: 'ligne-a',
          headerText: 'Retard - travaux en cours',
        },
        {
          kind: 'alert',
          tripId: 'course-9',
          stopId: 'arret-9',
          headerText: 'Retard - travaux en cours',
        },
      ]);
    });

    it("retombe sur la premiere traduction disponible quand aucune n'est en francais", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-2',
            alert: {
              informedEntity: [{ routeId: 'ligne-c' }],
              headerText: {
                translation: [{ text: 'Service disruption', language: 'en' }],
              },
            },
          },
        ]),
      );

      const [disruption] =
        (await service.fetchAlertDisruptions(URL_ALERTS)) ?? [];
      expect(disruption.headerText).toBe('Service disruption');
    });

    it("genere une seule entree generique quand l'alerte ne cible aucune entite precise", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-3',
            alert: {
              informedEntity: [],
              headerText: {
                translation: [{ text: 'Info generale', language: 'fr' }],
              },
            },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);

      expect(result).toEqual([{ kind: 'alert', headerText: 'Info generale' }]);
    });

    it('inclut une alerte sans activePeriod (toujours active par defaut GTFS-RT)', async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-4',
            alert: { informedEntity: [{ routeId: 'ligne-d' }] },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);
      expect(result).toHaveLength(1);
    });

    it("inclut une alerte dont activePeriod couvre l'instant present", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-5',
            alert: {
              informedEntity: [{ routeId: 'ligne-e' }],
              activePeriod: [
                { start: nowSeconds - 3600, end: nowSeconds + 3600 },
              ],
            },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);
      expect(result).toHaveLength(1);
    });

    it("exclut une alerte dont l'activePeriod n'a pas encore commence", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-6',
            alert: {
              informedEntity: [{ routeId: 'ligne-f' }],
              activePeriod: [{ start: nowSeconds + 3600 }],
            },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);
      expect(result).toEqual([]);
    });

    it("exclut une alerte dont l'activePeriod est deja terminee", async () => {
      fetchSpy.mockResolvedValue(
        feedResponse([
          {
            id: 'alerte-7',
            alert: {
              informedEntity: [{ routeId: 'ligne-g' }],
              activePeriod: [{ end: nowSeconds - 3600 }],
            },
          },
        ]),
      );

      const result = await service.fetchAlertDisruptions(URL_ALERTS);
      expect(result).toEqual([]);
    });

    it('renvoie null (sans exception) si le flux Alerts est injoignable', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(
        service.fetchAlertDisruptions(URL_ALERTS),
      ).resolves.toBeNull();
    });
  });
});
