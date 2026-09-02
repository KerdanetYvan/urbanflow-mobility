import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import type { StartFollowingTripDto } from './dto/start-following-trip.dto';
import { FollowedTrip } from './followed-trip.entity';
import { FollowedTripService } from './followed-trip.service';

function createRepositoryMock() {
  return {
    findOneBy: jest.fn(),
    find: jest.fn(),
    create: jest.fn((data: Partial<FollowedTrip>) => data),
    save: jest.fn((data: Partial<FollowedTrip>) =>
      Promise.resolve({ id: 'followed-1', ...data }),
    ),
    delete: jest.fn().mockResolvedValue({ affected: 0 }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

const DTO: StartFollowingTripDto = {
  originLat: 48.11,
  originLon: -1.68,
  originLabel: 'République',
  destinationLat: 48.12,
  destinationLon: -1.67,
  destinationLabel: 'Gare',
  endTime: '2026-01-15T09:00:00.000Z',
  segments: [{ mode: 'BUS', routeId: 'ligne-a', tripId: 'course-1' }],
  transportModes: undefined,
};

describe('FollowedTripService', () => {
  let service: FollowedTripService;
  let repository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repository = createRepositoryMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        FollowedTripService,
        { provide: getRepositoryToken(FollowedTrip), useValue: repository },
      ],
    }).compile();
    service = moduleRef.get(FollowedTripService);
  });

  describe('startFollowing', () => {
    it("cree un nouveau suivi quand l'utilisateur n'en avait aucun", async () => {
      repository.findOneBy.mockResolvedValue(null);

      const result = await service.startFollowing('user-1', DTO);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          originLat: 48.11,
          destinationLabel: 'Gare',
          segments: DTO.segments,
          endTime: new Date(DTO.endTime),
          lastNotifiedDisruptionSignature: null,
        }),
      );
      expect(repository.create.mock.calls[0][0]).not.toHaveProperty('id');
      expect(result.id).toBe('followed-1');
    });

    it(
      'remplace silencieusement le suivi existant (meme id, upsert) plutot ' +
        "que d'echouer ou d'en creer un second",
      async () => {
        repository.findOneBy.mockResolvedValue({
          id: 'followed-existant',
          userId: 'user-1',
        });

        await service.startFollowing('user-1', DTO);

        expect(repository.create).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'followed-existant' }),
        );
      },
    );

    it('reinitialise lastNotifiedDisruptionSignature a null pour un nouveau suivi', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'followed-existant',
        userId: 'user-1',
        lastNotifiedDisruptionSignature: 'alert|ligne-a',
      });

      await service.startFollowing('user-1', DTO);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ lastNotifiedDisruptionSignature: null }),
      );
    });
  });

  it('findCurrent renvoie le suivi de cet utilisateur', async () => {
    repository.findOneBy.mockResolvedValue({ id: 'followed-1' });

    const result = await service.findCurrent('user-1');

    expect(repository.findOneBy).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(result).toEqual({ id: 'followed-1' });
  });

  it("findCurrent renvoie null quand l'utilisateur ne suit rien", async () => {
    repository.findOneBy.mockResolvedValue(null);

    await expect(service.findCurrent('user-1')).resolves.toBeNull();
  });

  it("stopFollowing supprime le suivi de l'utilisateur, sans erreur si deja absent", async () => {
    await service.stopFollowing('user-1');

    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });

  it('findAllActive filtre sur endTime dans le futur', async () => {
    repository.find.mockResolvedValue([]);

    await service.findAllActive();

    // FindOperator (MoreThan) plutot qu'un objectContaining imbrique :
    // repository.find n'etant pas type generiquement dans ce mock,
    // toHaveBeenCalledWith(expect.objectContaining(...)) imbrique perd le
    // typage et declenche no-unsafe-assignment - on lit directement l'appel
    // capture a la place.
    const [options] = repository.find.mock.calls[0] as [
      { where: { endTime: { _type: string } } },
    ];
    expect(options.where.endTime._type).toBe('moreThan');
  });

  it('recordNotifiedDisruption met a jour la signature de la ligne concernee', async () => {
    await service.recordNotifiedDisruption('followed-1', 'alert|ligne-a');

    expect(repository.update).toHaveBeenCalledWith(
      { id: 'followed-1' },
      { lastNotifiedDisruptionSignature: 'alert|ligne-a' },
    );
  });

  describe('purgeExpired', () => {
    it('supprime les suivis dont endTime est deja passe', async () => {
      repository.delete.mockResolvedValue({ affected: 2 });

      await service.purgeExpired();

      const [criteria] = repository.delete.mock.calls[0] as [
        { endTime: { _type: string } },
      ];
      expect(criteria.endTime._type).toBe('lessThan');
    });

    it('ne plante pas quand rien a purger', async () => {
      repository.delete.mockResolvedValue({ affected: 0 });

      await expect(service.purgeExpired()).resolves.toBeUndefined();
    });
  });
});
