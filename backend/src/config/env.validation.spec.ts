import { validateEnv } from './env.validation';

/** Cle valide (32 octets une fois decodee depuis le base64). */
const VALID_KEY = 'ZmFrZWtleWZha2VrZXlmYWtla2V5ZmFrZWtleTEyMzQ=';

/** Jeu de variables minimal qui doit passer la validation sans erreur. */
function validConfig(): Record<string, unknown> {
  return {
    DATABASE_URL: 'postgresql://u:p@postgres:5432/db',
    JWT_SECRET: 'secret-access',
    JWT_REFRESH_SECRET: 'secret-refresh',
    GEOLOCATION_ENCRYPTION_KEY: VALID_KEY,
  };
}

describe('validateEnv', () => {
  it('laisse passer une configuration complete et valide', () => {
    expect(() => validateEnv(validConfig())).not.toThrow();
  });

  it('renvoie la configuration telle quelle, y compris les cles non validees ici', () => {
    const config = { ...validConfig(), CORS_ORIGIN: 'http://localhost:5173' };

    const result = validateEnv(config);

    // Aucune variable non listee dans le schema ne doit etre perdue au passage.
    expect(result.CORS_ORIGIN).toBe('http://localhost:5173');
    expect(result.DATABASE_URL).toBe(config.DATABASE_URL);
  });

  it('echoue si GEOLOCATION_ENCRYPTION_KEY est absente (cause de l issue #281)', () => {
    const config = validConfig();
    delete config.GEOLOCATION_ENCRYPTION_KEY;

    expect(() => validateEnv(config)).toThrow(/GEOLOCATION_ENCRYPTION_KEY/);
  });

  it('echoue si GEOLOCATION_ENCRYPTION_KEY ne decode pas en 32 octets', () => {
    const config = {
      ...validConfig(),
      GEOLOCATION_ENCRYPTION_KEY: Buffer.from('trop-courte').toString('base64'),
    };

    expect(() => validateEnv(config)).toThrow(/32 octets/);
  });

  it('echoue si un secret JWT manque', () => {
    const config = validConfig();
    delete config.JWT_SECRET;

    expect(() => validateEnv(config)).toThrow(/JWT_SECRET/);
  });

  it('echoue si DATABASE_URL manque', () => {
    const config = validConfig();
    delete config.DATABASE_URL;

    expect(() => validateEnv(config)).toThrow(/DATABASE_URL/);
  });

  it('agrege plusieurs manques dans un seul message', () => {
    const config = validConfig();
    delete config.JWT_SECRET;
    delete config.JWT_REFRESH_SECRET;

    try {
      validateEnv(config);
      fail('validateEnv aurait du lever');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).toMatch(/JWT_SECRET/);
      expect(message).toMatch(/JWT_REFRESH_SECRET/);
    }
  });
});
