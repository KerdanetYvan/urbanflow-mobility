import { TransportMode } from '../profiles/transport-mode.enum';
import { ScoringService } from '../scoring/scoring.service';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  let service: TripsService;
  let otpClient: { planTrip: jest.Mock };
  let profilesService: { findByUserIdOrNull: jest.Mock };
  let tripHistoryService: { record: jest.Mock };

  beforeEach(() => {
    otpClient = { planTrip: jest.fn() };
    profilesService = { findByUserIdOrNull: jest.fn() };
    tripHistoryService = { record: jest.fn().mockResolvedValue(undefined) };
    // ScoringService reel (pas de mock) avec un stub meteo neutre (pas de
    // pluie) : le comportement du classement (y compris le critere meteo,
    // issue #17) est teste separement dans scoring.service.spec.ts /
    // weather.service.spec.ts, pas ici.
    service = new TripsService(
      otpClient as never,
      profilesService as never,
      new ScoringService({
        getCurrentConditions: () => Promise.resolve(null),
      } as never),
      tripHistoryService as never,
    );
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

  it('transmet les modes de transport preferes tels quels a OtpClientService (issue #87)', async () => {
    otpClient.planTrip.mockResolvedValue([]);

    await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      transportModes: [TransportMode.BUS, TransportMode.TRAM],
    });

    expect(otpClient.planTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        transportModes: [TransportMode.BUS, TransportMode.TRAM],
      }),
    );
  });

  it('reformate les itineraires OTP en segments avec dates ISO et trace decode (issue #8)', async () => {
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
            // Encode exactement [{48.85,2.35}, {48.851,2.351}] (voir
            // polyline.spec.ts pour des chaines capturees contre un vrai OTP).
            legGeometry: { points: 'o_diHo~iMgEgE' },
          },
          {
            mode: 'BUS',
            // route = nom long (jamais ce qu'on veut afficher, voir
            // TripsService#mapLeg) : different de routeShortName a dessein,
            // pour verifier qu'on prend bien le bon champ.
            route: 'Ligne Test - Boucle Centre',
            routeShortName: 'T1',
            // Couleurs telles que renvoyees par OTP (issue #129, section 8) -
            // sans '#', relayees telles quelles (voir TripsService#mapLeg).
            routeColor: 'EE1D23',
            routeTextColor: 'FFFFFF',
            startTime: 61000,
            endTime: 601000,
            distance: 1300,
            from: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
            to: { name: 'Université', lat: 48.86, lon: 2.36 },
            // Pas de legGeometry sur ce leg : verifie le repli sur [from, to].
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

    // Des itineraires normaux ont ete trouves : pas de second appel OTP
    // (repli a pied), pas de fallback dans la reponse (issue #190).
    expect(otpClient.planTrip).toHaveBeenCalledTimes(1);
    expect(result.fallback).toBeUndefined();
    expect(result.itineraries).toEqual([
      {
        startTime: new Date(1000).toISOString(),
        endTime: new Date(601000).toISOString(),
        durationSeconds: 600,
        transfers: 1,
        segments: [
          {
            mode: 'WALK',
            routeName: undefined,
            routeColor: undefined,
            routeTextColor: undefined,
            startTime: new Date(1000).toISOString(),
            endTime: new Date(61000).toISOString(),
            durationSeconds: 60,
            distanceMeters: 150.5,
            from: { name: 'Place Centrale', lat: 48.85, lon: 2.35 },
            to: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
            geometry: [
              { lat: 48.85, lon: 2.35 },
              { lat: 48.851, lon: 2.351 },
            ],
          },
          {
            mode: 'BUS',
            routeName: 'T1',
            routeColor: 'EE1D23',
            routeTextColor: 'FFFFFF',
            startTime: new Date(61000).toISOString(),
            endTime: new Date(601000).toISOString(),
            durationSeconds: 540,
            distanceMeters: 1300,
            from: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
            to: { name: 'Université', lat: 48.86, lon: 2.36 },
            // Pas de legGeometry en entree (voir le leg WALK ci-dessus) :
            // repli sur [from, to].
            geometry: [
              { lat: 48.851, lon: 2.351 },
              { lat: 48.86, lon: 2.36 },
            ],
          },
        ],
      },
    ]);
  });

  it('renvoie itineraries vide (sans fallback) quand ni le transport en commun ni la marche ne donnent de trajet', async () => {
    // mockResolvedValue s'applique aux DEUX appels (recherche normale + repli
    // a pied) : les deux renvoient une liste vide.
    otpClient.planTrip.mockResolvedValue([]);

    const result = await service.search({
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
    });

    // Repli a pied tente (2e appel), sans succes -> etat vide "sec".
    expect(otpClient.planTrip).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ itineraries: [] });
  });

  describe('repli a pied quand aucun trajet en transport en commun (issue #190)', () => {
    const WALK_OTP_ITINERARY = {
      startTime: 0,
      endTime: 900_000,
      duration: 900,
      transfers: 0,
      legs: [
        {
          mode: 'WALK',
          startTime: 0,
          endTime: 900_000,
          distance: 1100,
          from: { name: 'Place Centrale', lat: 48.85, lon: 2.35 },
          to: { name: 'Université', lat: 48.86, lon: 2.36 },
        },
      ],
    };

    it('retente en WALK seul et renvoie le trajet a pied avec fallback: walk-only', async () => {
      otpClient.planTrip
        .mockResolvedValueOnce([]) // recherche normale : rien
        .mockResolvedValueOnce([WALK_OTP_ITINERARY]); // repli a pied : trouve

      const result = await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(otpClient.planTrip).toHaveBeenCalledTimes(2);
      // Le 2e appel force mode=WALK (walkOnly), sans filtre de modes.
      expect(otpClient.planTrip).toHaveBeenLastCalledWith(
        expect.objectContaining({ walkOnly: true }),
      );
      expect(result.fallback).toEqual({ kind: 'walk-only' });
      expect(result.itineraries).toHaveLength(1);
      expect(result.itineraries[0].segments.map((s) => s.mode)).toEqual([
        'WALK',
      ]);
    });

    it('ne tente pas le repli a pied quand la recherche normale a deja des resultats', async () => {
      otpClient.planTrip.mockResolvedValueOnce([WALK_OTP_ITINERARY]);

      const result = await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(otpClient.planTrip).toHaveBeenCalledTimes(1);
      expect(result.fallback).toBeUndefined();
    });
  });

  it(
    "recupere le profil de l'utilisateur authentifie pour personnaliser le " +
      'classement (issue #16)',
    async () => {
      otpClient.planTrip.mockResolvedValue([]);
      const profile = {
        preferredTransportModes: [],
        accessibilityPreferences: [],
      };
      profilesService.findByUserIdOrNull.mockResolvedValue(profile);

      await service.search(
        {
          originLat: 48.85,
          originLon: 2.35,
          destinationLat: 48.86,
          destinationLon: 2.36,
        },
        'user-1',
      );

      expect(profilesService.findByUserIdOrNull).toHaveBeenCalledWith('user-1');
    },
  );

  it(
    "n'appelle pas ProfilesService quand la recherche est anonyme " +
      '(pas de userId, issue #16)',
    async () => {
      otpClient.planTrip.mockResolvedValue([]);

      await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(profilesService.findByUserIdOrNull).not.toHaveBeenCalled();
    },
  );

  it(
    "enregistre la recherche dans l'historique quand un utilisateur " +
      'authentifie est fourni (issue #11)',
    async () => {
      otpClient.planTrip.mockResolvedValue([]);
      const dto = {
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
        originLabel: 'Part-Dieu',
        destinationLabel: 'Bellecour',
      };

      await service.search(dto, 'user-1');

      expect(tripHistoryService.record).toHaveBeenCalledWith('user-1', dto);
    },
  );

  it(
    "n'enregistre rien dans l'historique pour une recherche anonyme " +
      '(pas de userId, issue #11)',
    async () => {
      otpClient.planTrip.mockResolvedValue([]);

      await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(tripHistoryService.record).not.toHaveBeenCalled();
    },
  );

  /** Construit un itineraire OTP a un leg BUS, seul le depart varie d'un appel a l'autre (issue #127). */
  function busItinerary(startTime: number, endTime: number) {
    return {
      startTime,
      endTime,
      duration: endTime - startTime,
      transfers: 0,
      legs: [
        {
          mode: 'BUS',
          route: 'Ligne Test - Boucle Centre',
          routeShortName: 'T1',
          startTime,
          endTime,
          distance: 1300,
          from: { name: 'Arret Bus A', lat: 48.851, lon: 2.351 },
          to: { name: 'Université', lat: 48.86, lon: 2.36 },
        },
      ],
    };
  }

  it(
    'regroupe les itineraires strictement identiques (meme ligne, memes ' +
      'arrets) sous un seul resultat, avec les horaires suivants exposes ' +
      'via nextDepartures (issue #127)',
    async () => {
      // Trois departs de la meme ligne T1, memes arrets - reproduit le cas
      // observe en session (Kennedy -> La Poterie, 5 fois le meme trajet).
      // Volontairement hors ordre chronologique en entree : verifie que le
      // regroupement trie lui-meme par depart, sans dependre de l'ordre OTP.
      otpClient.planTrip.mockResolvedValue([
        busItinerary(600_000, 1_200_000),
        busItinerary(0, 600_000),
        busItinerary(1_200_000, 1_800_000),
      ]);

      const result = await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(result.itineraries).toHaveLength(1);
      expect(result.itineraries[0].startTime).toEqual(
        new Date(0).toISOString(),
      );
      expect(result.itineraries[0].nextDepartures).toEqual([
        new Date(0).toISOString(),
        new Date(600_000).toISOString(),
        new Date(1_200_000).toISOString(),
      ]);
    },
  );

  it(
    'ne regroupe pas des itineraires distincts (lignes differentes) - ' +
      'aucun champ nextDepartures ajoute, comportement inchange (issue #127)',
    async () => {
      otpClient.planTrip.mockResolvedValue([
        busItinerary(0, 600_000),
        {
          ...busItinerary(0, 600_000),
          legs: [{ ...busItinerary(0, 600_000).legs[0], routeShortName: 'T2' }],
        },
      ]);

      const result = await service.search({
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(result.itineraries).toHaveLength(2);
      expect(result.itineraries[0].nextDepartures).toBeUndefined();
      expect(result.itineraries[1].nextDepartures).toBeUndefined();
    },
  );
});
