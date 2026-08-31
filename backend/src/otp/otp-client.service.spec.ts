import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TransportMode } from '../profiles/transport-mode.enum';
import { OtpClientService } from './otp-client.service';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

describe('OtpClientService', () => {
  let service: OtpClientService;
  let configService: { get: jest.Mock };
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'OTP_URL') return 'http://otp:8080/otp/routers/default';
        return defaultValue;
      }),
    };
    service = new OtpClientService(configService as never);
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('renvoie les itineraires quand OTP repond sans erreur', async () => {
    const itineraries = [
      {
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        transfers: 0,
        legs: [],
      },
    ];
    fetchSpy.mockResolvedValue(jsonResponse({ plan: { itineraries } }));

    const result = await service.planTrip({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    expect(result).toEqual(itineraries);
  });

  it('construit fromPlace/toPlace/date/time/mode dans la requete envoyee a OTP', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ plan: { itineraries: [] } }));

    await service.planTrip({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      departureTime: new Date('2026-01-15T10:30:00Z'),
    });

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('fromPlace')).toBe('48.85,2.35');
    expect(calledUrl.searchParams.get('toPlace')).toBe('48.86,2.36');
    expect(calledUrl.searchParams.get('mode')).toBe('TRANSIT,WALK');
    expect(calledUrl.searchParams.get('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calledUrl.searchParams.get('time')).toMatch(/^\d{2}:\d{2}:\d{2}$/);
  });

  it("traduit les modes de transport préférés en paramètre `mode` d'OTP (issue #87)", async () => {
    fetchSpy.mockResolvedValue(jsonResponse({ plan: { itineraries: [] } }));

    await service.planTrip({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      transportModes: [TransportMode.BUS, TransportMode.METRO],
    });

    const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get('mode')).toBe('WALK,BUS,SUBWAY');
  });

  it("renvoie un tableau vide quand OTP repond avec une erreur 'aucun trajet' (id != 400)", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: { id: 404, message: 'PATH_NOT_FOUND' } }),
    );

    const result = await service.planTrip({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    expect(result).toEqual([]);
  });

  it("leve BadRequestException quand OTP renvoie l'erreur 400 (hors zone couverte)", async () => {
    fetchSpy.mockResolvedValue(
      jsonResponse({ error: { id: 400, message: 'OUTSIDE_BOUNDS' } }),
    );

    await expect(
      service.planTrip({
        originLat: 0,
        originLon: 0,
        destinationLat: 48.86,
        destinationLon: 2.36,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('leve ServiceUnavailableException quand OTP est injoignable', async () => {
    fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.planTrip({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  it('leve ServiceUnavailableException quand OTP repond avec un statut HTTP en erreur', async () => {
    fetchSpy.mockResolvedValue(jsonResponse({}, false, 502));

    await expect(
      service.planTrip({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
  });

  describe('geocode', () => {
    it('renvoie les resultats du geocodeur OTP', async () => {
      const results = [
        { lat: 45.762, lng: 4.848, description: 'Gare Test', id: '1:B' },
      ];
      fetchSpy.mockResolvedValue(jsonResponse(results));

      const result = await service.geocode('Gare');

      expect(result).toEqual(results);
      const calledUrl = new URL(fetchSpy.mock.calls[0][0] as string);
      expect(calledUrl.pathname).toContain('/geocode');
      expect(calledUrl.searchParams.get('query')).toBe('Gare');
    });

    it('renvoie un tableau vide quand OTP ne trouve aucun lieu (pas une erreur)', async () => {
      fetchSpy.mockResolvedValue(jsonResponse([]));

      const result = await service.geocode('xyzzynotfound');

      expect(result).toEqual([]);
    });

    it('leve ServiceUnavailableException quand OTP est injoignable', async () => {
      fetchSpy.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.geocode('Gare')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('leve ServiceUnavailableException quand OTP repond avec un statut HTTP en erreur', async () => {
      fetchSpy.mockResolvedValue(jsonResponse({}, false, 404));

      await expect(service.geocode('Gare')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
