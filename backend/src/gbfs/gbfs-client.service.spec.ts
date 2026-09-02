import { GbfsClientService } from './gbfs-client.service';

/** Meme helper que nominatim-client.service.spec.ts. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

const DISCOVERY_URL = 'https://operateur.example/gbfs/gbfs.json';

describe('GbfsClientService', () => {
  let service: GbfsClientService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    service = new GbfsClientService();
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  /** Simule la resolution des trois URL (discovery, information, status) par contenu de requete. */
  function mockStationBasedFeeds({
    information,
    status,
  }: {
    information: unknown;
    status: unknown;
  }) {
    fetchSpy.mockImplementation((input) => {
      // GbfsClientService appelle toujours fetch() avec une chaine (jamais un objet Request/URL).
      const url = input as string;
      if (url.endsWith('gbfs.json')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              fr: {
                feeds: [
                  {
                    name: 'station_information',
                    url: 'https://operateur.example/gbfs/station_information.json',
                  },
                  {
                    name: 'station_status',
                    url: 'https://operateur.example/gbfs/station_status.json',
                  },
                ],
              },
            },
          }),
        );
      }
      if (url.endsWith('station_information.json')) {
        return Promise.resolve(jsonResponse(information));
      }
      if (url.endsWith('station_status.json')) {
        return Promise.resolve(jsonResponse(status));
      }
      return Promise.reject(new Error(`URL inattendue dans le test : ${url}`));
    });
  }

  it('fusionne station_information et station_status par station_id (flux station-based, ex. STAR Rennes)', async () => {
    mockStationBasedFeeds({
      information: {
        data: {
          stations: [
            {
              station_id: '5501',
              name: 'République',
              lat: 48.110026,
              lon: -1.678037,
              capacity: 45,
            },
          ],
        },
      },
      status: {
        data: {
          stations: [
            {
              station_id: '5501',
              num_bikes_available: 4,
              num_docks_available: 41,
              is_renting: 1,
            },
          ],
        },
      },
    });

    const result = await service.fetchStations(DISCOVERY_URL);

    expect(result).toEqual([
      {
        id: '5501',
        name: 'République',
        lat: 48.110026,
        lon: -1.678037,
        kind: 'station',
        bikesAvailable: 4,
        docksAvailable: 41,
        isRenting: true,
      },
    ]);
  });

  it('normalise is_renting expose en 0/1 (legacy) comme en booleen strict', async () => {
    mockStationBasedFeeds({
      information: {
        data: { stations: [{ station_id: 'a', lat: 1, lon: 1 }] },
      },
      status: {
        data: {
          stations: [
            { station_id: 'a', num_bikes_available: 0, is_renting: 0 },
          ],
        },
      },
    });

    const [station] = await service.fetchStations(DISCOVERY_URL);
    expect(station.isRenting).toBe(false);
  });

  it("deduit docksAvailable de la capacite si station_status ne l'expose pas", async () => {
    mockStationBasedFeeds({
      information: {
        data: { stations: [{ station_id: 'a', lat: 1, lon: 1, capacity: 20 }] },
      },
      status: {
        data: {
          stations: [
            { station_id: 'a', num_bikes_available: 6, is_renting: true },
          ],
        },
      },
    });

    const [station] = await service.fetchStations(DISCOVERY_URL);
    expect(station.docksAvailable).toBe(14);
  });

  it('garde une station sans entree status correspondante (marquee fermee a la location plutot que masquee)', async () => {
    mockStationBasedFeeds({
      information: {
        data: { stations: [{ station_id: 'orpheline', lat: 1, lon: 1 }] },
      },
      status: { data: { stations: [] } },
    });

    const [station] = await service.fetchStations(DISCOVERY_URL);
    expect(station).toMatchObject({
      id: 'orpheline',
      bikesAvailable: 0,
      isRenting: false,
    });
  });

  it("exploite free_bike_status quand aucun feed station_information n'est publie (vehicules free-floating)", async () => {
    fetchSpy.mockImplementation((input) => {
      // GbfsClientService appelle toujours fetch() avec une chaine (jamais un objet Request/URL).
      const url = input as string;
      if (url.endsWith('gbfs.json')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              feeds: [
                // Forme v3 (pas d'indirection par langue) - verifie que
                // extractFeeds accepte aussi cette variante du standard.
                {
                  name: 'free_bike_status',
                  url: 'https://operateur.example/gbfs/free_bike_status.json',
                },
              ],
            },
          }),
        );
      }
      if (url.endsWith('free_bike_status.json')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              bikes: [
                {
                  bike_id: 'v1',
                  lat: 48.1,
                  lon: -1.6,
                  is_reserved: false,
                  is_disabled: false,
                },
                // Reserve : exclu (pas reellement disponible).
                {
                  bike_id: 'v2',
                  lat: 48.2,
                  lon: -1.7,
                  is_reserved: true,
                  is_disabled: false,
                },
                // Desactive : exclu.
                {
                  bike_id: 'v3',
                  lat: 48.3,
                  lon: -1.8,
                  is_reserved: false,
                  is_disabled: 1,
                },
              ],
            },
          }),
        );
      }
      return Promise.reject(new Error(`URL inattendue dans le test : ${url}`));
    });

    const result = await service.fetchStations(DISCOVERY_URL);

    expect(result).toEqual([
      {
        id: 'v1',
        lat: 48.1,
        lon: -1.6,
        kind: 'vehicle',
        bikesAvailable: 1,
        isRenting: true,
      },
    ]);
  });

  it('renvoie un tableau vide (sans exception) si le fichier de decouverte est injoignable', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.fetchStations(DISCOVERY_URL)).resolves.toEqual([]);
  });

  it('renvoie un tableau vide si le fichier de decouverte repond en erreur HTTP', async () => {
    fetchSpy.mockResolvedValue(jsonResponse(null, false, 503));

    await expect(service.fetchStations(DISCOVERY_URL)).resolves.toEqual([]);
  });

  it("renvoie un tableau vide si aucun feed exploitable n'est publie (ni station_information, ni free_bike_status)", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({
        data: {
          fr: { feeds: [{ name: 'system_information', url: 'https://x/y' }] },
        },
      }),
    );

    await expect(service.fetchStations(DISCOVERY_URL)).resolves.toEqual([]);
  });

  it('renvoie un tableau vide si station_information repond en JSON illisible', async () => {
    fetchSpy.mockImplementation((input) => {
      // GbfsClientService appelle toujours fetch() avec une chaine (jamais un objet Request/URL).
      const url = input as string;
      if (url.endsWith('gbfs.json')) {
        return Promise.resolve(
          jsonResponse({
            data: {
              fr: {
                feeds: [
                  {
                    name: 'station_information',
                    url: 'https://operateur.example/gbfs/station_information.json',
                  },
                ],
              },
            },
          }),
        );
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('invalid json')),
      } as unknown as Response);
    });

    await expect(service.fetchStations(DISCOVERY_URL)).resolves.toEqual([]);
  });
});
