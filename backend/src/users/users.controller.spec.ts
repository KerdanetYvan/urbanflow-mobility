import type { JwtPayload } from '../auth/jwt-payload.interface';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  describe('removeMine (issue #164, DELETE /users/me)', () => {
    it("delegue a UsersService.remove avec l'id du token courant (jamais un id fourni par le client) et le mot de passe du corps de requete", async () => {
      const remove = jest.fn().mockResolvedValue(undefined);
      const usersService = { remove } as unknown as UsersService;
      const controller = new UsersController(usersService);
      const currentUser: JwtPayload = {
        sub: 'user-1',
        email: 'alice@example.com',
      };

      await controller.removeMine(currentUser, {
        password: 'MotDePasse123!',
      });

      expect(remove).toHaveBeenCalledWith('user-1', 'MotDePasse123!');
    });
  });
});
