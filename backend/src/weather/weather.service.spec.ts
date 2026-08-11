import { WeatherService } from './weather.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('WeatherService', () => {
  let service: WeatherService;
  let configService: { get: jest.Mock };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    service = new WeatherService(configService as never);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    jest.useRealTimers();
  });

  it("renvoie les precipitations en cours quand l'API meteo repond", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ current: { precipitation: 3.2, rain: 3.2 } }),
    );

    const weather = await service.getCurrentConditions();

    expect(weather).toEqual({ precipitationMm: 3.2 });
  });

  it("interroge un point de reference fixe (metropole), pas une position d'usager", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ current: { precipitation: 0, rain: 0 } }),
    );

    await service.getCurrentConditions();

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('latitude')).toBe('48.1173');
    expect(calledUrl.searchParams.get('longitude')).toBe('-1.6778');
  });

  it('met en cache le resultat (un seul appel fetch pour deux appels rapproches)', async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ current: { precipitation: 1, rain: 1 } }),
    );

    await service.getCurrentConditions();
    await service.getCurrentConditions();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('refait un appel apres expiration du cache (30 min)', async () => {
    jest.useFakeTimers({ now: new Date('2026-01-01T08:00:00.000Z') });
    fetchSpy.mockResolvedValue(
      jsonResponse({ current: { precipitation: 1, rain: 1 } }),
    );

    await service.getCurrentConditions();
    jest.setSystemTime(new Date('2026-01-01T08:31:00.000Z'));
    await service.getCurrentConditions();

    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('memoise une requete en cours (une seule requete HTTP pour deux appels simultanes)', async () => {
    let resolveFetch!: (response: Response) => void;
    fetchSpy.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const [first, second] = [
      service.getCurrentConditions(),
      service.getCurrentConditions(),
    ];
    resolveFetch(jsonResponse({ current: { precipitation: 0, rain: 0 } }));

    await Promise.all([first, second]);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("renvoie null (pas d'exception) quand l'API meteo est injoignable", async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.getCurrentConditions()).resolves.toBeNull();
  });

  it("renvoie null (pas d'exception) quand l'API meteo repond avec un statut en erreur", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, false, 503));

    await expect(service.getCurrentConditions()).resolves.toBeNull();
  });

  it('renvoie null quand la reponse ne contient pas le champ "current"', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}));

    await expect(service.getCurrentConditions()).resolves.toBeNull();
  });
});
