import { GbfsCacheService } from './gbfs-cache.service';
import { GbfsClientService } from './gbfs-client.service';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';

const STATION: SharedMobilityStation = {
  id: '5501',
  name: 'République',
  lat: 48.11,
  lon: -1.68,
  kind: 'station',
  bikesAvailable: 4,
  docksAvailable: 41,
  isRenting: true,
};

describe('GbfsCacheService', () => {
  let fetchStations: jest.Mock;
  let service: GbfsCacheService;

  beforeEach(() => {
    fetchStations = jest.fn();
    const gbfsClient = { fetchStations } as unknown as GbfsClientService;
    const configService = {
      get: (_key: string, fallback?: unknown) => fallback,
    };
    service = new GbfsCacheService(gbfsClient, configService as never);
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

  it('transmet GBFS_DISCOVERY_URL (ou son defaut) au connecteur', async () => {
    fetchStations.mockResolvedValue([]);
    await service.refresh();

    expect(fetchStations).toHaveBeenCalledWith(expect.stringContaining('gbfs'));
  });
});
