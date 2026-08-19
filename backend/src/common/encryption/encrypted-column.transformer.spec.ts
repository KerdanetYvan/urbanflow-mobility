import { createEncryptedColumnTransformer } from './encrypted-column.transformer';

/** Cle de test valide (32 octets, base64) - generee une fois, sans rapport avec une cle de production. */
const TEST_KEY = 'ZmFrZWtleWZha2VrZXlmYWtla2V5ZmFrZWtleTEyMzQ=';

describe('createEncryptedColumnTransformer', () => {
  const originalKey = process.env.GEOLOCATION_ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.GEOLOCATION_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env.GEOLOCATION_ENCRYPTION_KEY = originalKey;
  });

  it('dechiffre exactement la valeur numerique chiffree (aller-retour to/from)', () => {
    const transformer = createEncryptedColumnTransformer<number>();

    const stored = transformer.to(48.858093);

    expect(typeof stored).toBe('string');
    // Le texte chiffre ne doit jamais laisser transparaitre la valeur en
    // clair (verification de base que le chiffrement a bien lieu, pas
    // juste une serialisation JSON deguisee).
    expect(stored).not.toContain('48.858093');
    expect(transformer.from(stored as string)).toBe(48.858093);
  });

  it('dechiffre exactement une valeur chaine chiffree (issue #113, adresse textuelle)', () => {
    const transformer = createEncryptedColumnTransformer<string>();

    const stored = transformer.to('12 rue de la Paix');

    expect(stored).not.toContain('rue de la Paix');
    expect(transformer.from(stored as string)).toBe('12 rue de la Paix');
  });

  it('laisse passer null/undefined sans tenter de les chiffrer', () => {
    const transformer = createEncryptedColumnTransformer<number>();

    expect(transformer.to(null)).toBeNull();
    expect(transformer.to(undefined)).toBeUndefined();
    expect(transformer.from(null)).toBeNull();
    expect(transformer.from(undefined)).toBeUndefined();
  });

  it(
    'produit un texte chiffre different a chaque appel pour la meme valeur ' +
      '(IV aleatoire) - deux lignes avec la meme coordonnee ne sont pas ' +
      'distinguables en base',
    () => {
      const transformer = createEncryptedColumnTransformer<number>();

      const first = transformer.to(48.858093);
      const second = transformer.to(48.858093);

      expect(first).not.toBe(second);
      expect(transformer.from(first as string)).toBe(48.858093);
      expect(transformer.from(second as string)).toBe(48.858093);
    },
  );

  it(
    'rejette un texte chiffre altere plutot que de renvoyer une valeur ' +
      "corrompue (verification du tag d'authentification GCM)",
    () => {
      const transformer = createEncryptedColumnTransformer<number>();
      const stored = transformer.to(48.858093) as string;
      const [iv, authTag, ciphertext] = stored.split(':');
      // Altere un seul octet du texte chiffre (premier caractere base64) -
      // simule une corruption/alteration en base.
      const tampered = [
        iv,
        authTag,
        (ciphertext[0] === 'A' ? 'B' : 'A') + ciphertext.slice(1),
      ].join(':');

      expect(() => transformer.from(tampered)).toThrow();
    },
  );

  it('leve une erreur explicite si GEOLOCATION_ENCRYPTION_KEY est absente', () => {
    delete process.env.GEOLOCATION_ENCRYPTION_KEY;
    const transformer = createEncryptedColumnTransformer<number>();

    expect(() => transformer.to(48.858093)).toThrow(
      /GEOLOCATION_ENCRYPTION_KEY manquante/,
    );
  });

  it('leve une erreur explicite si la cle ne fait pas 32 octets une fois decodee', () => {
    process.env.GEOLOCATION_ENCRYPTION_KEY =
      Buffer.from('trop-courte').toString('base64');
    const transformer = createEncryptedColumnTransformer<number>();

    expect(() => transformer.to(48.858093)).toThrow(/32 octets/);
  });
});
