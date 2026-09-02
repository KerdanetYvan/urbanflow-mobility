import type { MobilityOperatorConfig } from '../operators/interfaces/mobility-operator-config.interface';
import type { OperatorsService } from '../operators/operators.service';
import { GtfsRealtimeCacheService } from './gtfs-realtime-cache.service';
import { GtfsRealtimeClientService } from './gtfs-realtime-client.service';
import type { RealtimeDisruption } from './interfaces/realtime-disruption.interface';

const STAR_RENNES: MobilityOperatorConfig = {
  id: 'star-rennes',
  name: 'STAR (Rennes Métropole)',
  gtfsRealtimeTripUpdatesUrl: 'https://star.example/trip-updates',
  gtfsRealtimeAlertsUrl: 'https://star.example/alerts',
};

/** Second operateur (issue #15, critere "test avec un flux operateur fictif") - meme forme, aucune donnee reelle. */
const OPERATEUR_FICTIF: MobilityOperatorConfig = {
  id: 'operateur-fictif',
  name: 'Opérateur fictif de test',
  gtfsRealtimeTripUpdatesUrl: 'https://fictif.example/trip-updates',
  gtfsRealtimeAlertsUrl: 'https://fictif.example/alerts',
};

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
const ALERT_FICTIVE: RealtimeDisruption = {
  kind: 'alert',
  routeId: 'ligne-fictive',
  headerText: 'Alerte fictive',
};

describe('GtfsRealtimeCacheService', () => {
  let fetchTripUpdateDisruptions: jest.Mock;
  let fetchAlertDisruptions: jest.Mock;
  let getOperators: jest.Mock;
  let service: GtfsRealtimeCacheService;

  beforeEach(() => {
    fetchTripUpdateDisruptions = jest.fn().mockResolvedValue([]);
    fetchAlertDisruptions = jest.fn().mockResolvedValue([]);
    getOperators = jest.fn().mockReturnValue([STAR_RENNES]);
    const client = {
      fetchTripUpdateDisruptions,
      fetchAlertDisruptions,
    } as unknown as GtfsRealtimeClientService;
    const operatorsService = { getOperators } as unknown as OperatorsService;
    service = new GtfsRealtimeCacheService(client, operatorsService);
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

  it("transmet les URLs de l'operateur au connecteur", async () => {
    await service.refresh();

    expect(fetchTripUpdateDisruptions).toHaveBeenCalledWith(
      STAR_RENNES.gtfsRealtimeTripUpdatesUrl,
    );
    expect(fetchAlertDisruptions).toHaveBeenCalledWith(
      STAR_RENNES.gtfsRealtimeAlertsUrl,
    );
  });

  it(
    "n'appelle pas le connecteur pour un flux qu'un operateur ne publie pas " +
      '(gtfsRealtimeAlertsUrl absent)',
    async () => {
      getOperators.mockReturnValue([
        {
          id: 'sans-alerts',
          name: 'Sans alertes',
          gtfsRealtimeTripUpdatesUrl: 'https://x.example',
        },
      ]);

      await service.refresh();

      expect(fetchAlertDisruptions).not.toHaveBeenCalled();
    },
  );

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

  describe('plusieurs operateurs (issue #15, critere d\'acceptation "test avec un flux operateur fictif")', () => {
    it('fusionne les perturbations de tous les operateurs configures', async () => {
      getOperators.mockReturnValue([STAR_RENNES, OPERATEUR_FICTIF]);
      fetchTripUpdateDisruptions.mockResolvedValue([]);
      fetchAlertDisruptions.mockImplementation((url: string) =>
        Promise.resolve(
          url === STAR_RENNES.gtfsRealtimeAlertsUrl ? [ALERT] : [ALERT_FICTIVE],
        ),
      );

      await service.refresh();

      expect(service.getAllDisruptions()).toEqual([ALERT, ALERT_FICTIVE]);
    });

    it(
      "l'echec d'un operateur ne prive pas les autres de leur mise a jour " +
        '(le cache reste par operateur, pas un simple tableau global ecrase)',
      async () => {
        getOperators.mockReturnValue([STAR_RENNES, OPERATEUR_FICTIF]);
        fetchTripUpdateDisruptions.mockResolvedValue([]);
        fetchAlertDisruptions.mockImplementation((url: string) =>
          Promise.resolve(
            url === STAR_RENNES.gtfsRealtimeAlertsUrl
              ? [ALERT]
              : [ALERT_FICTIVE],
          ),
        );
        await service.refresh();
        expect(service.getAllDisruptions()).toEqual([ALERT, ALERT_FICTIVE]);

        // L'operateur fictif tombe en panne (null) au rafraichissement
        // suivant - ses anciennes alertes restent en cache, celles de
        // star-rennes continuent d'etre mises a jour normalement.
        fetchAlertDisruptions.mockImplementation((url: string) =>
          Promise.resolve(
            url === STAR_RENNES.gtfsRealtimeAlertsUrl ? [ALERT] : null,
          ),
        );
        await service.refresh();

        expect(service.getAllDisruptions()).toEqual([ALERT, ALERT_FICTIVE]);
      },
    );

    it('findDisruptions recoupe sur tous les operateurs confondus', async () => {
      getOperators.mockReturnValue([STAR_RENNES, OPERATEUR_FICTIF]);
      fetchTripUpdateDisruptions.mockResolvedValue([]);
      fetchAlertDisruptions.mockImplementation((url: string) =>
        Promise.resolve(
          url === STAR_RENNES.gtfsRealtimeAlertsUrl ? [ALERT] : [ALERT_FICTIVE],
        ),
      );
      await service.refresh();

      expect(service.findDisruptions({ routeId: 'ligne-fictive' })).toEqual([
        ALERT_FICTIVE,
      ]);
    });
  });

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
