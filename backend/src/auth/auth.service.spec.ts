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
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };
  let mailService: { sendPasswordResetEmail: jest.Mock };

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
    jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
    // Renvoie simplement la valeur par defaut passee en 2eme argument : se
    // comporte comme un ConfigService qui n'aurait rien de configure,
    // suffisant pour ces tests (on ne teste pas ConfigService lui-meme).
    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };
    mailService = {
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      usersService as never,
      jwtService as never,
      configService as never,
      mailService as never,
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

  describe('refresh', () => {
    it("emet une nouvelle paire de jetons a partir d'un refresh token valide", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        email: 'alice@example.com',
      });
      usersService.findById.mockResolvedValue({
        id: 'user-1',
        email: 'alice@example.com',
      });
      jwtService.signAsync
        .mockResolvedValueOnce('new-access-token')
        .mockResolvedValueOnce('new-refresh-token');

      const result = await service.refresh('un-refresh-token-valide');

      expect(result).toEqual({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('rejette un refresh token invalide/expire', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('jwt expired'));

      await expect(service.refresh('token-invalide')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it("rejette si l'utilisateur associe au refresh token n'existe plus", async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-supprime',
        email: 'parti@example.com',
      });
      usersService.findById.mockResolvedValue(null);

      await expect(
        service.refresh('token-utilisateur-supprime'),
      ).rejects.toThrow(UnauthorizedException);
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
