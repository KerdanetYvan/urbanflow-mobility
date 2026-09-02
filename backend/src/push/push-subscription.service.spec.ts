import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import type { SubscribePushDto } from './dto/subscribe-push.dto';
import { PushSubscription } from './push-subscription.entity';
import { PushSubscriptionService } from './push-subscription.service';

function createRepositoryMock() {
  return {
    find: jest.fn(),
    create: jest.fn((data: Partial<PushSubscription>) => data),
    save: jest.fn((data: Partial<PushSubscription>) =>
      Promise.resolve({ id: 'sub-1', ...data }),
    ),
    remove: jest.fn(),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
  };
}

const DTO: SubscribePushDto = {
  endpoint: 'https://push.example/abc',
  keys: { p256dh: 'p256dh-1', auth: 'auth-1' },
};

describe('PushSubscriptionService', () => {
  let service: PushSubscriptionService;
  let repository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repository = createRepositoryMock();
    const moduleRef = await Test.createTestingModule({
      providers: [
        PushSubscriptionService,
        {
          provide: getRepositoryToken(PushSubscription),
          useValue: repository,
        },
      ],
    }).compile();
    service = moduleRef.get(PushSubscriptionService);
  });

  describe('subscribe', () => {
    it("cree un nouvel abonnement quand l'endpoint n'existe pas encore pour cet utilisateur", async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.subscribe('user-1', DTO);

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        endpoint: DTO.endpoint,
        p256dhKey: 'p256dh-1',
        authKey: 'auth-1',
      });
      expect(result.id).toBe('sub-1');
    });

    it(
      'met a jour les cles de la ligne existante (comparaison en memoire par ' +
        'endpoint decrypte, pas de WHERE SQL sur une colonne chiffree) plutot ' +
        "que d'en creer une deuxieme",
      async () => {
        const existing = {
          id: 'sub-existant',
          userId: 'user-1',
          endpoint: DTO.endpoint,
          p256dhKey: 'ancienne-cle',
          authKey: 'ancien-auth',
        } as PushSubscription;
        repository.find.mockResolvedValue([existing]);

        const result = await service.subscribe('user-1', DTO);

        expect(repository.create).not.toHaveBeenCalled();
        expect(repository.save).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'sub-existant',
            p256dhKey: 'p256dh-1',
            authKey: 'auth-1',
          }),
        );
        expect(result.id).toBe('sub-existant');
      },
    );
  });

  describe('unsubscribe', () => {
    it('retire la ligne correspondant a cet endpoint', async () => {
      const existing = {
        id: 'sub-1',
        userId: 'user-1',
        endpoint: DTO.endpoint,
      } as PushSubscription;
      repository.find.mockResolvedValue([existing]);

      await service.unsubscribe('user-1', DTO.endpoint);

      expect(repository.remove).toHaveBeenCalledWith(existing);
    });

    it("ne leve pas d'erreur si l'endpoint est deja absent (idempotent)", async () => {
      repository.find.mockResolvedValue([]);

      await expect(
        service.unsubscribe('user-1', 'https://push.example/inconnu'),
      ).resolves.toBeUndefined();
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });

  it('findByUserId renvoie tous les abonnements de cet utilisateur', async () => {
    repository.find.mockResolvedValue([{ id: 'sub-1' }]);

    const result = await service.findByUserId('user-1');

    expect(repository.find).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(result).toEqual([{ id: 'sub-1' }]);
  });

  it('removeById supprime par id', async () => {
    await service.removeById('sub-1');

    expect(repository.delete).toHaveBeenCalledWith({ id: 'sub-1' });
  });
});
