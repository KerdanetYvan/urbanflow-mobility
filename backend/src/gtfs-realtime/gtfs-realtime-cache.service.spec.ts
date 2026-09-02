import { GtfsRealtimeCacheService } from './gtfs-realtime-cache.service';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';
import type { RealtimeDisruption } from './interfaces/realtime-disruption.interface';

const CANCELLATION: RealtimeDisruption = {
  kind: 'cancellation',
  tripId: 'course-1',
  routeId: 'ligne-a',
};
const ALERT: RealtimeDisruption = {
  kind: 'alert',
  routeId: 'ligne-b',
  headerText: 'Travaux',
};

describe('GtfsRealtimeCacheService', () => {
  let fetchTripUpdateDisruptions: jest.Mock;
  let fetchAlertDisruptions: jest.Mock;
  let service: GtfsRealtimeCacheService;

  beforeEach(() => {
    fetchTripUpdateDisruptions = jest.fn().mockResolvedValue([]);
    fetchAlertDisruptions = jest.fn().mockResolvedValue([]);
    const client = {
      fetchTripUpdateDisruptions,
      fetchAlertDisruptions,
    } as unknown as GtfsRealtimeClientService;
    const configService = {
      get: (_key: string, fallback?: unknown) => fallback,
    };
    service = new GtfsRealtimeCacheService(client, configService as never);
  });

  it('le cache est vide avant tout rafraichissement', () => {
    expect(service.getAllDisruptions()).toEqual([]);
  });

  it("onModuleInit charge immediatement le cache (pas besoin d'attendre le premier @Cron)", async () => {
    fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);

    await service.onModuleInit();

    expect(service.getAllDisruptions()).toEqual([CANCELLATION]);
  });

  it('refresh() combine TripUpdate et Alerts', async () => {
    fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);
    fetchAlertDisruptions.mockResolvedValue([ALERT]);

    await service.refresh();

    expect(service.getAllDisruptions()).toEqual([CANCELLATION, ALERT]);
  });

  it(
    'un rafraichissement TripUpdate en echec (null) conserve les dernieres ' +
      'perturbations TripUpdate connues, sans affecter les Alerts',
    async () => {
      fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);
      fetchAlertDisruptions.mockResolvedValue([ALERT]);
      await service.refresh();

      fetchTripUpdateDisruptions.mockResolvedValue(null);
      fetchAlertDisruptions.mockResolvedValue([]);
      await service.refresh();

      // TripUpdate conserve (echec), Alerts remplace par [] (succes, 0 alerte).
      expect(service.getAllDisruptions()).toEqual([CANCELLATION]);
    },
  );

  it(
    'un rafraichissement Alerts en echec (null) conserve les dernieres ' +
      'alertes connues, sans affecter TripUpdate',
    async () => {
      fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);
      fetchAlertDisruptions.mockResolvedValue([ALERT]);
      await service.refresh();

      fetchTripUpdateDisruptions.mockResolvedValue([]);
      fetchAlertDisruptions.mockResolvedValue(null);
      await service.refresh();

      expect(service.getAllDisruptions()).toEqual([ALERT]);
    },
  );

  it(
    'un rafraichissement reussi avec un resultat VIDE remplace bel et bien le cache ' +
      '("0 perturbation" est un etat normal, pas une panne - contrairement a GbfsCacheService)',
    async () => {
      fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);
      await service.refresh();
      expect(service.getAllDisruptions()).toEqual([CANCELLATION]);

      fetchTripUpdateDisruptions.mockResolvedValue([]);
      await service.refresh();

      expect(service.getAllDisruptions()).toEqual([]);
    },
  );

  describe('findDisruptions', () => {
    beforeEach(async () => {
      fetchTripUpdateDisruptions.mockResolvedValue([CANCELLATION]);
      fetchAlertDisruptions.mockResolvedValue([ALERT]);
      await service.refresh();
    });

    it('filtre par routeId', () => {
      expect(service.findDisruptions({ routeId: 'ligne-a' })).toEqual([
        CANCELLATION,
      ]);
    });

    it('filtre par tripId', () => {
      expect(service.findDisruptions({ tripId: 'course-1' })).toEqual([
        CANCELLATION,
      ]);
    });

    it("renvoie un tableau vide sans routeId ni tripId (evite de renvoyer tout le cache par erreur d'appel)", () => {
      expect(service.findDisruptions({})).toEqual([]);
    });

    it('renvoie un tableau vide quand rien ne correspond', () => {
      expect(service.findDisruptions({ routeId: 'ligne-inconnue' })).toEqual(
        [],
      );
    });
  });
});
