import { createEncryptedColumnTransformer } from '../../common/encryption/encrypted-column.transformer';
import { TripHistoryService } from './trip-history.service';
import type { TripHistoryEntry } from './trip-history-entry.entity';

/**
 * Cle de test valide (32 octets, base64). Calculee a la volee plutot
 * qu'ecrite en dur : aucune chaine ressemblant a un secret dans la source
 * (evite un faux positif du scan gitleaks de la CI).
 */
const TEST_KEY = Buffer.from('0'.repeat(32)).toString('base64');

describe('TripHistoryService', () => {
  let service: TripHistoryService;
  let repository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    query: jest.Mock;
    delete: jest.Mock;
  };

  beforeEach(() => {
    repository = {
      create: jest.fn((data: Partial<TripHistoryEntry>) => data),
      save: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      query: jest.fn().mockResolvedValue([]),
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

  describe('findRecent - resilience a une entree indechiffrable (issue #281)', () => {
    const originalKey = process.env.GEOLOCATION_ENCRYPTION_KEY;

    beforeEach(() => {
      process.env.GEOLOCATION_ENCRYPTION_KEY = TEST_KEY;
    });

    afterEach(() => {
      process.env.GEOLOCATION_ENCRYPTION_KEY = originalKey;
    });

    /**
     * Construit une ligne SQL brute (colonnes snake_case, coordonnees/libelles
     * chiffres avec TEST_KEY) telle que la renverrait historyRepository.query
     * dans le repli tolerant.
     */
    function rawRow(overrides: {
      id: string;
      searchedAt: Date;
      destinationLat?: number;
      destinationLon?: number;
    }): Record<string, string | null> {
      const num = createEncryptedColumnTransformer<number>();
      const text = createEncryptedColumnTransformer<string>();
      return {
        id: overrides.id,
        user_id: 'user-1',
        origin_lat: num.to(48.85) as string,
        origin_lon: num.to(2.35) as string,
        destination_lat: num.to(overrides.destinationLat ?? 48.86) as string,
        destination_lon: num.to(overrides.destinationLon ?? 2.36) as string,
        origin_label: text.to('Part-Dieu') as string,
        destination_label: null,
        searched_at: overrides.searchedAt.toISOString(),
      };
    }

    it('bascule sur une lecture brute quand find() echoue, et renvoie les entrees dechiffrables', async () => {
      repository.find.mockRejectedValue(
        new Error('Unsupported state or unable to authenticate data'),
      );
      repository.query.mockResolvedValue([
        rawRow({ id: 'ok', searchedAt: new Date() }),
      ]);

      const result = await service.findRecent('user-1');

      expect(repository.query).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('ok');
      expect(result[0].originLabel).toBe('Part-Dieu');
    });

    it('ignore la (ou les) ligne(s) indechiffrable(s) sans faire tomber tout l historique', async () => {
      repository.find.mockRejectedValue(new Error('cle rotee'));
      repository.query.mockResolvedValue([
        rawRow({
          id: 'lisible',
          searchedAt: new Date(),
          destinationLat: 48.86,
          destinationLon: 2.36,
        }),
        // Valeur qui n'est pas un texte chiffre valide -> from() leve, la
        // ligne doit etre ecartee, pas propagee.
        {
          id: 'corrompue',
          user_id: 'user-1',
          origin_lat: 'pas-un-chiffre-valide',
          origin_lon: 'xxx',
          destination_lat: 'xxx',
          destination_lon: 'xxx',
          origin_label: null,
          destination_label: null,
          searched_at: new Date().toISOString(),
        },
      ]);

      const result = await service.findRecent('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('lisible');
    });

    it('n echoue pas si find() aboutit normalement (le chemin nominal ne touche pas a query)', async () => {
      repository.find.mockResolvedValue([]);

      const result = await service.findRecent('user-1');

      expect(result).toEqual([]);
      expect(repository.query).not.toHaveBeenCalled();
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
