import type { MobilityOperatorConfig } from '../operators/interfaces/mobility-operator-config.interface';
import type { OperatorsService } from '../operators/operators.service';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';
import { GbfsCacheService } from './gbfs-cache.service';
import { GbfsClientService } from './gbfs-client.service';

const STAR_RENNES: MobilityOperatorConfig = {
  id: 'star-rennes',
  name: 'STAR (Rennes Métropole)',
  gbfsDiscoveryUrl: 'https://star.example/gbfs.json',
};

/** Second operateur (issue #15, critere "test avec un flux operateur fictif") - meme forme, aucune donnee reelle. */
const OPERATEUR_FICTIF: MobilityOperatorConfig = {
  id: 'operateur-fictif',
  name: 'Opérateur fictif de test',
  gbfsDiscoveryUrl: 'https://fictif.example/gbfs.json',
};

const STATION: SharedMobilityStation = {
  id: '5501',
  operatorId: STAR_RENNES.id,
  name: 'République',
  lat: 48.11,
  lon: -1.68,
  kind: 'station',
  bikesAvailable: 4,
  docksAvailable: 41,
  isRenting: true,
};

const STATION_FICTIVE: SharedMobilityStation = {
  id: '1',
  operatorId: OPERATEUR_FICTIF.id,
  name: 'Station fictive',
  lat: 45,
  lon: 0,
  kind: 'station',
  bikesAvailable: 2,
  docksAvailable: 8,
  isRenting: true,
};

describe('GbfsCacheService', () => {
  let fetchStations: jest.Mock;
  let getOperators: jest.Mock;
  let service: GbfsCacheService;

  beforeEach(() => {
    fetchStations = jest.fn();
    getOperators = jest.fn().mockReturnValue([STAR_RENNES]);
    const gbfsClient = { fetchStations } as unknown as GbfsClientService;
    const operatorsService = { getOperators } as unknown as OperatorsService;
    service = new GbfsCacheService(gbfsClient, operatorsService);
  });

  it('le cache est vide avant tout rafraichissement', () => {
    expect(service.getStations()).toEqual([]);
  });

  it("onModuleInit charge immediatement le cache (pas besoin d'attendre le premier @Cron)", async () => {
    fetchStations.mockResolvedValue([STATION]);

    await service.onModuleInit();

    expect(service.getStations()).toEqual([STATION]);
  });

  it('refresh() remplace le cache par le resultat du connecteur', async () => {
    fetchStations.mockResolvedValue([STATION]);
    await service.refresh();
    expect(service.getStations()).toEqual([STATION]);

    const AUTRE_STATION = { ...STATION, id: '5502', name: 'Gares' };
    fetchStations.mockResolvedValue([AUTRE_STATION]);
    await service.refresh();
    expect(service.getStations()).toEqual([AUTRE_STATION]);
  });

  it(
    'un rafraichissement vide alors que le cache contenait deja des stations est ignore ' +
      '(panne transitoire supposee, conserve les dernieres donnees connues)',
    async () => {
      fetchStations.mockResolvedValue([STATION]);
      await service.refresh();

      fetchStations.mockResolvedValue([]);
      await service.refresh();

      expect(service.getStations()).toEqual([STATION]);
    },
  );

  it('un rafraichissement vide alors que le cache etait DEJA vide reste vide (pas de panne a supposer)', async () => {
    fetchStations.mockResolvedValue([]);
    await service.refresh();
    expect(service.getStations()).toEqual([]);
  });

  it("transmet l'URL de decouverte et l'id de l'operateur au connecteur", async () => {
    fetchStations.mockResolvedValue([]);
    await service.refresh();

    expect(fetchStations).toHaveBeenCalledWith(
      STAR_RENNES.gbfsDiscoveryUrl,
      STAR_RENNES.id,
    );
  });

  describe('plusieurs operateurs (issue #15, critere d\'acceptation "test avec un flux operateur fictif")', () => {
    it('fusionne les stations de tous les operateurs configures publiant du GBFS', async () => {
      getOperators.mockReturnValue([STAR_RENNES, OPERATEUR_FICTIF]);
      fetchStations.mockImplementation((_url: string, operatorId: string) =>
        Promise.resolve(
          operatorId === STAR_RENNES.id ? [STATION] : [STATION_FICTIVE],
        ),
      );

      await service.refresh();

      expect(service.getStations()).toEqual([STATION, STATION_FICTIVE]);
      expect(fetchStations).toHaveBeenCalledWith(
        STAR_RENNES.gbfsDiscoveryUrl,
        STAR_RENNES.id,
      );
      expect(fetchStations).toHaveBeenCalledWith(
        OPERATEUR_FICTIF.gbfsDiscoveryUrl,
        OPERATEUR_FICTIF.id,
      );
    });

    it("ignore un operateur ne publiant pas de GBFS (gbfsDiscoveryUrl absent) - pas d'appel au connecteur pour lui", async () => {
      getOperators.mockReturnValue([
        STAR_RENNES,
        { id: 'sans-gbfs', name: 'Sans GBFS' },
      ]);
      fetchStations.mockResolvedValue([STATION]);

      await service.refresh();

      expect(fetchStations).toHaveBeenCalledTimes(1);
      expect(service.getStations()).toEqual([STATION]);
    });

    it(
      "l'echec d'un operateur ne prive pas les autres de leur mise a jour " +
        '(un tableau vide pour LUI SEUL ne doit pas vider le cache global tant ' +
        "qu'un autre operateur repond)",
      async () => {
        getOperators.mockReturnValue([STAR_RENNES, OPERATEUR_FICTIF]);
        fetchStations.mockImplementation((_url: string, operatorId: string) =>
          Promise.resolve(
            operatorId === STAR_RENNES.id ? [] : [STATION_FICTIVE],
          ),
        );

        await service.refresh();

        expect(service.getStations()).toEqual([STATION_FICTIVE]);
      },
    );
  });
});
