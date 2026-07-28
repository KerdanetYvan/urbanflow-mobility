import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { findByEmail: jest.Mock; findById: jest.Mock };
  let jwtService: { signAsync: jest.Mock; verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };

  // Instanciation directe (pas de module NestJS complet) : AuthService n'a
  // aucune logique liee au systeme d'injection de dependances lui-meme,
  // seulement a ses 3 collaborateurs mockes ici a la main.
  beforeEach(() => {
    usersService = { findByEmail: jest.fn(), findById: jest.fn() };
    jwtService = { signAsync: jest.fn(), verifyAsync: jest.fn() };
    // Renvoie simplement la valeur par defaut passee en 2eme argument : se
    // comporte comme un ConfigService qui n'aurait rien de configure,
    // suffisant pour ces tests (on ne teste pas ConfigService lui-meme).
    configService = {
      get: jest.fn((_key: string, defaultValue?: unknown) => defaultValue),
    };

    service = new AuthService(
      usersService as never,
      jwtService as never,
      configService as never,
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
});
