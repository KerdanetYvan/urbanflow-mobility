import { TripsService } from './trips.service';

describe('TripsService', () => {
  let service: TripsService;
  let otpClient: { planTrip: jest.Mock };

  beforeEach(() => {
    otpClient = { planTrip: jest.fn() };
    service = new TripsService(otpClient as never);
  });

  it('transmet les coordonnees et la date de depart telles que fournies a OtpClientService', async () => {
    otpClient.planTrip.mockResolvedValue([]);

    await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      departureTime: '2026-01-15T10:30:00.000Z',
    });

    expect(otpClient.planTrip).toHaveBeenCalledWith({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      departureTime: new Date('2026-01-15T10:30:00.000Z'),
    });
  });

  it("laisse departureTime absent quand aucune heure n'est fournie (OTP part alors de 'maintenant')", async () => {
    otpClient.planTrip.mockResolvedValue([]);

    await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    expect(otpClient.planTrip).toHaveBeenCalledWith(
      expect.objectContaining({ departureTime: undefined }),
    );
  });

  it('reformate les itineraires OTP en segments avec dates ISO', async () => {
    otpClient.planTrip.mockResolvedValue([
      {
        startTime: 1000,
        endTime: 601000,
        duration: 600,
        transfers: 1,
        legs: [
          {
            mode: 'WALK',
            route: '',
            routeShortName: '',
            startTime: 1000,
            endTime: 61000,
            distance: 150.5,
            from: { name: 'Place Centrale', lat: 48.85, lon: 2.35 },
            to: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
          },
          {
            mode: 'BUS',
            // route = nom long (jamais ce qu'on veut afficher, voir
            // TripsService#mapLeg) : different de routeShortName a dessein,
            // pour verifier qu'on prend bien le bon champ.
            route: 'Ligne Test - Boucle Centre',
            routeShortName: 'T1',
            startTime: 61000,
            endTime: 601000,
            distance: 1300,
            from: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
            to: { name: 'Université', lat: 48.86, lon: 2.36 },
          },
        ],
      },
    ]);

    const result = await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    expect(result).toEqual([
      {
        startTime: new Date(1000).toISOString(),
        endTime: new Date(601000).toISOString(),
        durationSeconds: 600,
        transfers: 1,
        segments: [
          {
            mode: 'WALK',
            routeName: undefined,
            startTime: new Date(1000).toISOString(),
            endTime: new Date(61000).toISOString(),
            durationSeconds: 60,
            distanceMeters: 150.5,
            from: { name: 'Place Centrale', lat: 48.85, lon: 2.35 },
            to: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
          },
          {
            mode: 'BUS',
            routeName: 'T1',
            startTime: new Date(61000).toISOString(),
            endTime: new Date(601000).toISOString(),
            durationSeconds: 540,
            distanceMeters: 1300,
            from: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
            to: { name: 'Université', lat: 48.86, lon: 2.36 },
          },
        ],
      },
    ]);
  });

  it("renvoie un tableau vide quand OtpClientService n'a trouve aucun itineraire", async () => {
    otpClient.planTrip.mockResolvedValue([]);

    const result = await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    expect(result).toEqual([]);
  });
});
