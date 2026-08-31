import { NominatimClientService } from './nominatim-client.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('NominatimClientService', () => {
  let service: NominatimClientService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    const configService = {
      get: (key: string) =>
        key === 'NOMINATIM_URL' ? 'http://nominatim:8080' : undefined,
    };
    service = new NominatimClientService(configService as never);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('construit la requête (viewbox métropole, bounded, langue fr, addressdetails)', async () => {
    fetchSpy.mockResolvedValue(jsonResponse([]));

    await service.search('Nemours');

    const url = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('q')).toBe('Nemours');
    expect(url.searchParams.get('format')).toBe('jsonv2');
    expect(url.searchParams.get('addressdetails')).toBe('1');
    expect(url.searchParams.get('countrycodes')).toBe('fr');
    expect(url.searchParams.get('accept-language')).toBe('fr');
    expect(url.searchParams.get('bounded')).toBe('1');
    expect(url.searchParams.get('viewbox')).toBe('-1.95,47.97,-1.48,48.30');
  });

  it('construit un libellé court "{numéro} {voie}, {commune}" à partir des champs structurés', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse([
        {
          lat: '48.1085',
          lon: '-1.6772',
          display_name:
            '12, Rue de Nemours, Centre, Rennes, Ille-et-Vilaine, Bretagne, 35000, France',
          address: {
            house_number: '12',
            road: 'Rue de Nemours',
            city: 'Rennes',
          },
        },
      ]),
    );

    const result = await service.search('Nemours');

    expect(result).toEqual([
      { label: '12 Rue de Nemours, Rennes', lat: 48.1085, lon: -1.6772 },
    ]);
  });

  it('omet le numéro quand il est absent, tombe sur town/village pour la commune', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse([
        {
          lat: '48.12',
          lon: '-1.64',
          display_name: 'Boulevard de la Liberté, ...',
          address: { road: 'Boulevard de la Liberté', town: 'Cesson-Sévigné' },
        },
      ]),
    );

    const result = await service.search('Liberté');

    expect(result[0].label).toBe('Boulevard de la Liberté, Cesson-Sévigné');
  });

  it('repli sur le premier segment du display_name quand ni voie ni commune', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse([
        {
          lat: '48.11',
          lon: '-1.68',
          display_name: 'Parc du Thabor, Rennes, ...',
          address: {},
        },
      ]),
    );

    const result = await service.search('Thabor');

    expect(result[0].label).toBe('Parc du Thabor');
  });

  it('ignore les résultats sans coordonnées exploitables', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse([
        { lat: 'not-a-number', lon: '-1.6', display_name: 'x', address: {} },
      ]),
    );

    expect(await service.search('x')).toEqual([]);
  });

  it('renvoie [] (sans lever) quand Nominatim est injoignable', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await service.search('Nemours')).toEqual([]);
  });

  it('renvoie [] quand Nominatim répond en erreur HTTP', async () => {
    fetchSpy.mockResolvedValue(jsonResponse('boom', false, 500));

    expect(await service.search('Nemours')).toEqual([]);
  });
});
