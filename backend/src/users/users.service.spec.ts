import { ConflictException, ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { QueryFailedError } from 'typeorm';
import { User } from './user.entity';
import { UsersService } from './users.service';

/**
 * Fausse implementation minimale du Repository TypeORM : seuls les
 * jest.fn() sont necessaires pour verifier le comportement de UsersService,
 * pas besoin d'une vraie base de donnees pour ces tests unitaires.
 */
function createRepositoryMock() {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((data: Partial<User>) => data),
    save: jest.fn(),
    remove: jest.fn(),
  };
}

describe('UsersService', () => {
  let service: UsersService;
  let repository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repository = createRepositoryMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  describe('create', () => {
    it('hache le mot de passe avant de sauvegarder (jamais en clair)', async () => {
      repository.findOneBy.mockResolvedValue(null);
      repository.save.mockImplementation((user: Partial<User>) =>
        Promise.resolve({ ...user, id: 'user-1' } as User),
      );

      const user = await service.create({
        email: 'alice@example.com',
        password: 'motdepasse123',
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
      const [savedUser] = repository.save.mock.calls[0] as [User];
      // Le hash bcrypt ne doit jamais etre egal au mot de passe en clair.
      expect(savedUser.passwordHash).not.toBe('motdepasse123');
      expect(savedUser.passwordHash).toMatch(/^\$2[aby]\$/); // prefixe bcrypt standard
      expect(user.email).toBe('alice@example.com');
    });

    it('refuse un email deja utilise (verification prealable)', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'existing',
        email: 'alice@example.com',
      });

      await expect(
        service.create({ email: 'alice@example.com', password: 'x'.repeat(8) }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('rattrape une violation de contrainte unique en base (condition de course)', async () => {
      repository.findOneBy.mockResolvedValue(null);
      const dbError = new QueryFailedError(
        'INSERT',
        [],
        new Error('duplicate'),
      );
      (dbError as unknown as { code: string }).code = '23505';
      repository.save.mockRejectedValue(dbError);

      await expect(
        service.create({ email: 'bob@example.com', password: 'x'.repeat(8) }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findByEmail', () => {
    it('delegue au repository', async () => {
      repository.findOneBy.mockResolvedValue(null);
      await service.findByEmail('alice@example.com');
      expect(repository.findOneBy).toHaveBeenCalledWith({
        email: 'alice@example.com',
      });
    });
  });

  describe("remove (issue #164, droit a l'effacement RGPD)", () => {
    it('supprime le compte quand le mot de passe de confirmation est correct', async () => {
      const passwordHash = await bcrypt.hash('MotDePasse123!', 4);
      const user = { id: 'user-1', email: 'alice@example.com', passwordHash };
      repository.findOneBy.mockResolvedValue(user);

      await service.remove('user-1', 'MotDePasse123!');

      expect(repository.remove).toHaveBeenCalledWith(user);
    });

    it('refuse la suppression si le mot de passe de confirmation est incorrect', async () => {
      const passwordHash = await bcrypt.hash('MotDePasse123!', 4);
      repository.findOneBy.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash,
      });

      await expect(
        service.remove('user-1', 'MauvaisMotDePasse'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.remove).not.toHaveBeenCalled();
    });

    it("leve une erreur si l'utilisateur n'existe plus (filet de securite, JwtStrategy verifie deja l'existence en amont)", async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.remove('user-inconnu', 'peu importe'),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.remove).not.toHaveBeenCalled();
    });
  });
});
