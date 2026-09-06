import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
    setResetToken: jest.Mock;
    findByValidResetToken: jest.Mock;
    resetPassword: jest.Mock;
  };
  let jwtService: {
    signAsync: jest.Mock;
    verifyAsync: jest.Mock;
    decode: jest.Mock;
  };
  let configService: { get: jest.Mock };
  let mailService: { sendPasswordResetEmail: jest.Mock };
  let refreshTokensRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };

  /** Dernier appel a refreshTokensRepository.update, sous forme de tuple [filtre, patch]. */
  function lastUpdateCall(): [
    Record<string, unknown>,
    Record<string, unknown>,
  ] {
    const calls = refreshTokensRepository.update.mock.calls;
    return calls[calls.length - 1] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
  }

  /** Ligne `refresh_tokens` complete, seuls les champs varies par le test sont a fournir. */
  function storedToken(overrides: Record<string, unknown> = {}) {
    return {
      id: 'jti-1',
      familyId: 'fam-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      consumedAt: null,
      revokedAt: null,
      replacedBy: null,
      createdAt: new Date(),
      ...overrides,
    };
  }

  // Instanciation directe (pas de module NestJS complet) : AuthService n'a
  // aucune logique liee au systeme d'injection de dependances lui-meme,
  // seulement a ses collaborateurs mockes ici a la main.
  beforeEach(() => {
    usersService = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      setResetToken: jest.fn(),
      findByValidResetToken: jest.fn(),
      resetPassword: jest.fn(),
    };
    jwtService = {
      signAsync: jest.fn(),
      verifyAsync: jest.fn(),
      // Par defaut : un `exp` a +7 j, comme un vrai refresh token signe.
      decode: jest.fn(() => ({
        exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      })),
    };
    // Renvoie simplement la valeur par defaut passee en 2eme argument : se
    // comporte comme un ConfigService qui n'aurait rien de configure,
    // suffisant pour ces tests (on ne teste pas ConfigService lui-meme).
    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };
    refreshTokensRepository = {
      create: jest.fn((row: unknown) => row),
      save: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };

    service = new AuthService(
      usersService as never,
      jwtService as never,
      configService as never,
      mailService as never,
      refreshTokensRepository as never,
    );
  });

  describe('login', () => {
    it("emet une paire de jetons quand l'email et le mot de passe sont corrects", async () => {
      const passwordHash = await bcrypt.hash('motdepasse123', 4);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash,
      });
      jwtService.signAsync
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      const result = await service.login({
        email: 'alice@example.com',
        password: 'motdepasse123',
      });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('rejette un mot de passe incorrect avec un message generique', async () => {
      const passwordHash = await bcrypt.hash('bonmotdepasse', 4);
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
        passwordHash,
      });

      await expect(
        service.login({ email: 'alice@example.com', password: 'mauvais' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it("rejette un email inexistant avec le MEME message generique (pas d'enumeration)", async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({
          email: 'inconnu@example.com',
          password: 'peu importe',
        }),
      ).rejects.toThrow('Email ou mot de passe incorrect');
    });
  });

  describe('refresh (rotation stricte, issue #268)', () => {
    /** Claims d'un refresh token verifie : identite + jti + famille. */
    const VALID_CLAIMS = {
      sub: 'user-1',
      email: 'alice@example.com',
      jti: 'jti-1',
      fam: 'fam-1',
    };

    beforeEach(() => {
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');
    });

    it('emet une nouvelle paire et consomme le refresh token presente', async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(storedToken());

      const result = await service.refresh('un-refresh-token-valide');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      // Le jeton courant est marque consomme et relie a son remplacant.
      expect(refreshTokensRepository.update).toHaveBeenCalledTimes(1);
      const [idArg, patch] = lastUpdateCall();
      expect(idArg).toBe('jti-1');
      expect(patch.consumedAt).toBeInstanceOf(Date);
      expect(typeof patch.replacedBy).toBe('string');
      // Une nouvelle ligne est persistee pour le refresh token emis.
      expect(refreshTokensRepository.save).toHaveBeenCalled();
    });

    it('rejette (et ne consomme rien) si la signature JWT est invalide/expiree', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refresh('token-invalide')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokensRepository.update).not.toHaveBeenCalled();
    });

    it('rejette un refresh token anterieur a la rotation (aucun claim jti)', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'alice@example.com',
      });

      await expect(service.refresh('token-legacy')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(refreshTokensRepository.findOne).not.toHaveBeenCalled();
    });

    it('revoque la famille annoncee si le jti est inconnu en base', async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(null);

      await expect(service.refresh('jti-fantome')).rejects.toThrow(
        UnauthorizedException,
      );
      const [filter, patch] = lastUpdateCall();
      expect(filter).toMatchObject({ familyId: 'fam-1' });
      expect(patch.revokedAt).toBeInstanceOf(Date);
    });

    it('rejette si la famille est deja revoquee', async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(
        storedToken({ revokedAt: new Date() }),
      );

      await expect(service.refresh('token-famille-revoquee')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('REJEU : un token deja consomme (hors fenetre de grace) revoque toute la famille', async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(
        storedToken({ consumedAt: new Date(Date.now() - 60_000) }),
      );

      await expect(service.refresh('token-rejoue')).rejects.toThrow(
        UnauthorizedException,
      );
      const [filter, patch] = lastUpdateCall();
      expect(filter).toMatchObject({ familyId: 'fam-1' });
      expect(patch.revokedAt).toBeInstanceOf(Date);
    });

    it('fenetre de grace : un token consomme il y a < 15 s re-emet une paire sans revoquer', async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(
        storedToken({ consumedAt: new Date(Date.now() - 3_000) }),
      );

      const result = await service.refresh('token-refresh-concurrent');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
      // Ni revocation de famille, ni re-consommation du jeton deja consomme.
      expect(refreshTokensRepository.update).not.toHaveBeenCalled();
      expect(refreshTokensRepository.save).toHaveBeenCalled();
    });

    it("revoque la famille si l'utilisateur associe n'existe plus", async () => {
      jwtService.verifyAsync.mockResolvedValue(VALID_CLAIMS);
      refreshTokensRepository.findOne.mockResolvedValue(storedToken());
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh('token-utilisateur-supprime'),
      ).rejects.toThrow(UnauthorizedException);
      const [filter, patch] = lastUpdateCall();
      expect(filter).toMatchObject({ familyId: 'fam-1' });
      expect(patch.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('purgeExpiredRefreshTokens', () => {
    it('supprime les lignes dont expires_at est passe', async () => {
      refreshTokensRepository.delete.mockResolvedValue({ affected: 4 });

      await service.purgeExpiredRefreshTokens();

      expect(refreshTokensRepository.delete).toHaveBeenCalledTimes(1);
      const [criteria] = refreshTokensRepository.delete.mock.calls[0] as [
        Record<string, unknown>,
      ];
      expect(criteria).toHaveProperty('expiresAt');
    });
  });

  describe('forgotPassword', () => {
    it('genere un token, l enregistre et envoie un email quand le compte existe', async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
      });

      const result = await service.forgotPassword({
        email: 'alice@example.com',
      });

      expect(usersService.setResetToken).toHaveBeenCalledTimes(1);
      const [userId, tokenHash, expiresAt] = usersService.setResetToken.mock
        .calls[0] as [string, string, Date];
      expect(userId).toBe('user-1');
      expect(tokenHash).toMatch(/^[0-9a-f]{64}$/); // hex SHA-256
      expect(expiresAt).toBeInstanceOf(Date);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());

      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'alice@example.com',
        expect.stringContaining('/reset-password?token='),
      );
      expect(result).toEqual({
        message:
          'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.',
      });
    });

    it("renvoie le MEME message generique et n'envoie aucun email si le compte n'existe pas (pas d'enumeration)", async () => {
      usersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'inconnu@example.com',
      });

      expect(usersService.setResetToken).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result).toEqual({
        message:
          'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.',
      });
    });

    it("ne fait pas echouer la demande si l'envoi d'email echoue (fire-and-forget)", async () => {
      usersService.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
      });
      mailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('SMTP indisponible'),
      );

      await expect(
        service.forgotPassword({ email: 'alice@example.com' }),
      ).resolves.toEqual({
        message:
          'Si un compte existe pour cet email, un lien de reinitialisation a ete envoye.',
      });
    });
  });

  describe('resetPassword', () => {
    it('met a jour le mot de passe quand le token est valide', async () => {
      usersService.findByValidResetToken.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
      });

      const result = await service.resetPassword({
        token: 'un-token-valide',
        newPassword: 'NouveauMotDePasse123!',
      });

      expect(usersService.findByValidResetToken).toHaveBeenCalledWith(
        expect.stringMatching(/^[0-9a-f]{64}$/),
      );
      expect(usersService.resetPassword).toHaveBeenCalledTimes(1);
      const [userId, newPasswordHash] = usersService.resetPassword.mock
        .calls[0] as [string, string];
      expect(userId).toBe('user-1');
      expect(
        await bcrypt.compare('NouveauMotDePasse123!', newPasswordHash),
      ).toBe(true);
      expect(result).toEqual({ message: 'Mot de passe reinitialise.' });
    });

    it('rejette un token invalide ou expire', async () => {
      usersService.findByValidResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'token-invalide',
          newPassword: 'NouveauMotDePasse123!',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(usersService.resetPassword).not.toHaveBeenCalled();
    });
  });
});
