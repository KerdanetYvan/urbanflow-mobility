import { PushController } from './push.controller';
import type { PushNotificationService } from './push-notification.service';
import type { PushSubscriptionService } from './push-subscription.service';

describe('PushController', () => {
  it('getPublicKey relaie la cle du service', () => {
    const pushNotificationService = {
      getPublicKey: jest.fn().mockReturnValue('public-key'),
    } as unknown as PushNotificationService;
    const controller = new PushController(
      pushNotificationService,
      {} as PushSubscriptionService,
    );

    expect(controller.getPublicKey()).toEqual({ publicKey: 'public-key' });
  });

  it('getPublicKey renvoie null si la config VAPID est absente cote serveur', () => {
    const pushNotificationService = {
      getPublicKey: jest.fn().mockReturnValue(null),
    } as unknown as PushNotificationService;
    const controller = new PushController(
      pushNotificationService,
      {} as PushSubscriptionService,
    );

    expect(controller.getPublicKey()).toEqual({ publicKey: null });
  });

  it("subscribe delegue au service avec l'id de l'utilisateur authentifie", async () => {
    const subscribe = jest
      .fn()
      .mockResolvedValue({ id: 'sub-1', endpoint: 'https://push.example/1' });
    const pushSubscriptionService = {
      subscribe,
    } as unknown as PushSubscriptionService;
    const controller = new PushController(
      {} as PushNotificationService,
      pushSubscriptionService,
    );
    const dto = {
      endpoint: 'https://push.example/1',
      keys: { p256dh: 'p', auth: 'a' },
    };

    const result = await controller.subscribe({ sub: 'user-1' } as never, dto);

    expect(subscribe).toHaveBeenCalledWith('user-1', dto);
    expect(result).toEqual({ id: 'sub-1' });
  });

  it("unsubscribe delegue au service avec l'id de l'utilisateur authentifie et l'endpoint fourni", async () => {
    const unsubscribe = jest.fn().mockResolvedValue(undefined);
    const pushSubscriptionService = {
      unsubscribe,
    } as unknown as PushSubscriptionService;
    const controller = new PushController(
      {} as PushNotificationService,
      pushSubscriptionService,
    );

    await controller.unsubscribe(
      { sub: 'user-1' } as never,
      'https://push.example/1',
    );

    expect(unsubscribe).toHaveBeenCalledWith(
      'user-1',
      'https://push.example/1',
    );
  });
});
