import { TripHistoryService } from './trip-history.service';
import type { TripHistoryEntry } from './trip-history-entry.entity';

describe('TripHistoryService', () => {
  let service: TripHistoryService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<TripHistoryEntry>) => data),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    service = new TripHistoryService(repository as never);
  });

  /** Construit une entree d'historique complete, seuls les champs varies par le test sont a fournir. */
  function entry(overrides: Partial<TripHistoryEntry>): TripHistoryEntry {
    return {
      id: 'entry-id',
      userId: 'user-1',
      user: undefined as never,
      originLat: 48.85,
      originLon: 2.35,
      destinationLat: 48.86,
      destinationLon: 2.36,
      originLabel: null,
      destinationLabel: null,
      searchedAt: new Date(),
      ...overrides,
    };
  }

  describe('record', () => {
    it('cree et sauvegarde une entree a partir de la recherche, avec les libelles fournis', async () => {
      await service.record('user-1', {
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
        originLabel: 'Part-Dieu',
        destinationLabel: 'Bellecour',
      });

      expect(repository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
        originLabel: 'Part-Dieu',
        destinationLabel: 'Bellecour',
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('remplace les libelles absents par null (jamais undefined en base)', async () => {
      await service.record('user-1', {
        originLat: 48.85,
        originLon: 2.35,
        destinationLat: 48.86,
        destinationLon: 2.36,
      });

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ originLabel: null, destinationLabel: null }),
      );
    });

    it("n'echoue jamais - une erreur de sauvegarde est loggee, pas relancee (ne doit jamais faire echouer une recherche)", async () => {
      repository.save.mockRejectedValue(new Error('DB down'));

      await expect(
        service.record('user-1', {
          originLat: 48.85,
          originLon: 2.35,
          destinationLat: 48.86,
          destinationLon: 2.36,
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findRecent', () => {
    it('deduplique les entrees portant le meme couple origine/destination, garde la plus recente', async () => {
      repository.find.mockResolvedValue([
        entry({
          id: 'recent',
          searchedAt: new Date('2026-08-15T00:00:00.000Z'),
          originLabel: 'Part-Dieu',
        }),
        entry({
          id: 'older',
          searchedAt: new Date('2026-08-01T00:00:00.000Z'),
          originLabel: 'Part-Dieu (ancien libelle)',
        }),
      ]);

      const result = await service.findRecent('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('recent');
      expect(result[0].originLabel).toBe('Part-Dieu');
    });

    it('ne deduplique pas des couples origine/destination reellement differents', async () => {
      repository.find.mockResolvedValue([
        entry({ id: 'a', destinationLat: 48.86, destinationLon: 2.36 }),
        entry({ id: 'b', destinationLat: 48.9, destinationLon: 2.4 }),
      ]);

      const result = await service.findRecent('user-1');

      expect(result).toHaveLength(2);
    });

    it('exclut les entrees au-dela de 12 mois glissants (RGPD, docs/specs/rgpd-geolocalisation.md)', async () => {
      const now = Date.now();
      const thirteenMonthsAgo = new Date(now - 396 * 24 * 60 * 60 * 1000);
      repository.find.mockResolvedValue([
        entry({ id: 'expired', searchedAt: thirteenMonthsAgo }),
      ]);

      const result = await service.findRecent('user-1');

      expect(result).toHaveLength(0);
    });

    it('plafonne a 10 trajets distincts', async () => {
      const entries = Array.from({ length: 15 }, (_, i) =>
        entry({
          id: `entry-${i}`,
          destinationLat: 48.86 + i * 0.01,
          destinationLon: 2.36,
        }),
      );
      repository.find.mockResolvedValue(entries);

      const result = await service.findRecent('user-1');

      expect(result).toHaveLength(10);
    });
  });

  describe('purgeExpired', () => {
    it('supprime les entrees perimees et renvoie le nombre supprime', async () => {
      repository.delete.mockResolvedValue({ affected: 3 });

      const count = await service.purgeExpired();

      expect(count).toBe(3);
      expect(repository.delete).toHaveBeenCalled();
    });

    it('renvoie 0 si "affected" est absent de la reponse TypeORM', async () => {
      repository.delete.mockResolvedValue({ affected: null });

      const count = await service.purgeExpired();

      expect(count).toBe(0);
    });
  });
});
