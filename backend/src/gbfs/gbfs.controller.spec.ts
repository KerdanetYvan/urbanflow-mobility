import { GbfsCacheService } from './gbfs-cache.service';
import { GbfsController } from './gbfs.controller';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';

describe('GbfsController', () => {
  it('renvoie tel quel le contenu du cache, sans jamais interroger le flux GBFS a la volee', () => {
    const stations: SharedMobilityStation[] = [
      {
        id: '5501',
        name: 'République',
        lat: 48.11,
        lon: -1.68,
        kind: 'station',
        bikesAvailable: 4,
        docksAvailable: 41,
        isRenting: true,
      },
    ];
    const getStations = jest.fn().mockReturnValue(stations);
    const cacheService = { getStations } as unknown as GbfsCacheService;
    const controller = new GbfsController(cacheService);

    expect(controller.findAll()).toBe(stations);
    expect(getStations).toHaveBeenCalledTimes(1);
  });

  it('renvoie un tableau vide (pas une erreur) quand le cache est encore vide', () => {
    const cacheService = {
      getStations: jest.fn().mockReturnValue([]),
    } as unknown as GbfsCacheService;
    const controller = new GbfsController(cacheService);

    expect(controller.findAll()).toEqual([]);
  });
});
