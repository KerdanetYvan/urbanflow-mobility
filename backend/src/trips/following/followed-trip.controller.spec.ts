import { NotFoundException } from '@nestjs/common';
import { FollowedTripController } from './followed-trip.controller';
import type { FollowedTripService } from './followed-trip.service';
import type { StartFollowingTripDto } from './dto/start-following-trip.dto';

const USER = { sub: 'user-1' } as never;
const DTO: StartFollowingTripDto = {
  originLat: 48.11,
  originLon: -1.68,
  destinationLat: 48.12,
  destinationLon: -1.67,
  endTime: '2026-01-15T09:00:00.000Z',
  segments: [{ mode: 'BUS' }],
};

describe('FollowedTripController', () => {
  it("create delegue au service avec l'id de l'utilisateur authentifie", async () => {
    const startFollowing = jest.fn().mockResolvedValue({ id: 'followed-1' });
    const controller = new FollowedTripController({
      startFollowing,
    } as unknown as FollowedTripService);

    const result = await controller.create(USER, DTO);

    expect(startFollowing).toHaveBeenCalledWith('user-1', DTO);
    expect(result).toEqual({ id: 'followed-1' });
  });

  describe('findCurrent', () => {
    it('renvoie le suivi courant quand il existe', async () => {
      const findCurrent = jest.fn().mockResolvedValue({ id: 'followed-1' });
      const controller = new FollowedTripController({
        findCurrent,
      } as unknown as FollowedTripService);

      await expect(controller.findCurrent(USER)).resolves.toEqual({
        id: 'followed-1',
      });
    });

    it("leve NotFoundException quand rien n'est suivi", async () => {
      const findCurrent = jest.fn().mockResolvedValue(null);
      const controller = new FollowedTripController({
        findCurrent,
      } as unknown as FollowedTripService);

      await expect(controller.findCurrent(USER)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  it("remove delegue au service avec l'id de l'utilisateur authentifie", async () => {
    const stopFollowing = jest.fn().mockResolvedValue(undefined);
    const controller = new FollowedTripController({
      stopFollowing,
    } as unknown as FollowedTripService);

    await controller.remove(USER);

    expect(stopFollowing).toHaveBeenCalledWith('user-1');
  });
});
