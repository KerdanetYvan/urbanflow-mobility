import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { AccessibilityPreference } from './accessibility-preference.enum';
import { MobilityProfile } from './mobility-profile.entity';
import { ProfilesService } from './profiles.service';
import { TransportMode } from './transport-mode.enum';

function createRepositoryMock() {
  return {
    findOneBy: jest.fn(),
    create: jest.fn((data: Partial<MobilityProfile>) => data),
    save: jest.fn((data: Partial<MobilityProfile>) =>
      Promise.resolve({ id: 'profile-1', ...data }),
    ),
    remove: jest.fn(),
  };
}

describe('ProfilesService', () => {
  let service: ProfilesService;
  let repository: ReturnType<typeof createRepositoryMock>;

  beforeEach(async () => {
    repository = createRepositoryMock();

    const moduleRef = await Test.createTestingModule({
      providers: [
        ProfilesService,
        { provide: getRepositoryToken(MobilityProfile), useValue: repository },
      ],
    }).compile();

    service = moduleRef.get(ProfilesService);
  });

  describe('create', () => {
    it("cree le profil rattache a l'utilisateur authentifie", async () => {
      repository.findOneBy.mockResolvedValue(null);

      const profile = await service.create('user-1', {
        preferredTransportModes: [TransportMode.CYCLING, TransportMode.WALKING],
        accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
      });

      expect(repository.save).toHaveBeenCalledTimes(1);
      const [savedProfile] = repository.save.mock.calls[0];
      expect(savedProfile.userId).toBe('user-1');
      expect(profile.accessibilityPreferences).toEqual([
        AccessibilityPreference.LIMIT_TRANSFERS,
      ]);
    });

    it('refuse la creation si un profil existe deja pour cet utilisateur', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'existing',
        userId: 'user-1',
      });

      await expect(
        service.create('user-1', {
          preferredTransportModes: [],
          accessibilityPreferences: [],
        }),
      ).rejects.toThrow(ConflictException);
      expect(repository.save).not.toHaveBeenCalled();
    });

    it('accepte une adresse domicile complete (issue #113)', async () => {
      repository.findOneBy.mockResolvedValue(null);

      const profile = await service.create('user-1', {
        preferredTransportModes: [],
        accessibilityPreferences: [],
        homeLabel: 'Domicile',
        homeLat: 48.111,
        homeLon: -1.682,
      });

      expect(profile.homeLabel).toBe('Domicile');
      expect(profile.homeLat).toBe(48.111);
      expect(profile.homeLon).toBe(-1.682);
      // Travail non fourni : normalise a null plutot que laisse undefined
      // (voir ProfilesService#create).
      expect(profile.workLat).toBeNull();
      expect(profile.workLon).toBeNull();
    });

    it('refuse une paire lat/lon incomplete (issue #113)', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.create('user-1', {
          preferredTransportModes: [],
          accessibilityPreferences: [],
          homeLat: 48.111,
          // homeLon absent : paire incomplete.
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('findByUserId', () => {
    it("leve NotFoundException si l'utilisateur n'a pas encore de profil", async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.findByUserId('user-sans-profil')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('renvoie le profil existant', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
      });

      const profile = await service.findByUserId('user-1');
      expect(profile.userId).toBe('user-1');
    });
  });

  describe('findByUserIdOrNull', () => {
    it("renvoie null (pas d'exception) si l'utilisateur n'a pas encore de profil", async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.findByUserIdOrNull('user-sans-profil'),
      ).resolves.toBeNull();
    });

    it('renvoie le profil existant', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
      });

      const profile = await service.findByUserIdOrNull('user-1');
      expect(profile?.userId).toBe('user-1');
    });
  });

  describe('update', () => {
    it('met a jour uniquement les champs fournis (mise a jour partielle)', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [TransportMode.WALKING],
        accessibilityPreferences: [],
      });

      const updated = await service.update('user-1', {
        accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
      });

      expect(updated.accessibilityPreferences).toEqual([
        AccessibilityPreference.LIMIT_TRANSFERS,
      ]);
      // Les champs non fournis dans la mise a jour restent inchanges.
      expect(updated.preferredTransportModes).toEqual([TransportMode.WALKING]);
    });

    it("leve NotFoundException si l'utilisateur n'a pas de profil a mettre a jour", async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('user-sans-profil', {
          accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('complete une adresse domicile deja partiellement enregistree (issue #113)', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        homeLat: 48.111,
        homeLon: null,
      });

      const updated = await service.update('user-1', { homeLon: -1.682 });

      expect(updated.homeLat).toBe(48.111);
      expect(updated.homeLon).toBe(-1.682);
    });

    it(
      'ne touche pas a une adresse domicile deja complete quand la mise a ' +
        'jour ne la concerne pas (issue #113)',
      async () => {
        repository.findOneBy.mockResolvedValue({
          id: 'profile-1',
          userId: 'user-1',
          preferredTransportModes: [],
          accessibilityPreferences: [],
          homeLat: 48.111,
          homeLon: -1.682,
        });

        const updated = await service.update('user-1', {
          accessibilityPreferences: [AccessibilityPreference.LIMIT_TRANSFERS],
        });

        expect(updated.homeLat).toBe(48.111);
        expect(updated.homeLon).toBe(-1.682);
      },
    );

    it('refuse de rendre une paire lat/lon incomplete (issue #113)', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        preferredTransportModes: [],
        accessibilityPreferences: [],
        homeLat: null,
        homeLon: null,
      });

      await expect(
        service.update('user-1', { homeLat: 48.111 }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.save).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('supprime le profil existant', async () => {
      const existingProfile = { id: 'profile-1', userId: 'user-1' };
      repository.findOneBy.mockResolvedValue(existingProfile);

      await service.remove('user-1');

      expect(repository.remove).toHaveBeenCalledWith(existingProfile);
    });

    it("leve NotFoundException si l'utilisateur n'a pas de profil a supprimer", async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove('user-sans-profil')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
