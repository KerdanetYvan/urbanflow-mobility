import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { UsersService } from '../users/users.service';
import { JwtStrategy } from './jwt.strategy';

/** Meme minimal que les autres specs du projet : jamais de ConfigService reel dans un test unitaire. */
function buildConfigService(): ConfigService {
  return { get: () => 'secret-de-test' } as unknown as ConfigService;
}

describe('JwtStrategy', () => {
  it("valide et renvoie le payload quand l'utilisateur existe toujours en base", async () => {
    const findById = jest.fn().mockResolvedValue({ id: 'user-1' });
    const usersService = { findById } as unknown as UsersService;
    const strategy = new JwtStrategy(buildConfigService(), usersService);

    const payload = { sub: 'user-1', email: 'alice@example.com' };
    await expect(strategy.validate(payload)).resolves.toEqual(payload);
    expect(findById).toHaveBeenCalledWith('user-1');
  });

  it(
    "rejette un token signe pour un compte qui n'existe plus (issue #164 - " +
      'suppression de compte : un access token deja emis reste signe/valide ' +
      "jusqu'a son expiration naturelle, ce lookup DB est ce qui coupe " +
      "l'acces immediatement plutot que d'attendre l'expiration)",
    async () => {
      const findById = jest.fn().mockResolvedValue(null);
      const usersService = { findById } as unknown as UsersService;
      const strategy = new JwtStrategy(buildConfigService(), usersService);

      await expect(
        strategy.validate({ sub: 'user-supprime', email: 'x@example.com' }),
      ).rejects.toThrow(UnauthorizedException);
    },
  );
});
