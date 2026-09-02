import webpush, { WebPushError } from 'web-push';
import { PushNotificationService } from './push-notification.service';
import type { PushSubscription } from './push-subscription.entity';

// Mock partiel : WebPushError doit rester la VRAIE classe (voir
// PushNotificationService#notifyUser, `error instanceof WebPushError`) -
// un automock complet la remplacerait par un constructeur factice qui
// n'execute jamais le vrai constructeur, donc sans statusCode/message
// exploitables dans les tests ci-dessous.
jest.mock('web-push', () => ({
  ...jest.requireActual<typeof import('web-push')>('web-push'),
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

function buildSubscription(overrides: Partial<PushSubscription> = {}) {
  return {
    id: 'sub-1',
    userId: 'user-1',
    endpoint: 'https://push.example/1',
    p256dhKey: 'p256dh-1',
    authKey: 'auth-1',
    ...overrides,
  } as PushSubscription;
}

describe('PushNotificationService', () => {
  let findByUserId: jest.Mock;
  let removeById: jest.Mock;
  let sendNotification: jest.SpiedFunction<typeof webpush.sendNotification>;

  function buildService(config: Record<string, string | undefined>) {
    findByUserId = jest.fn().mockResolvedValue([]);
    removeById = jest.fn().mockResolvedValue(undefined);
    const configService = { get: (key: string) => config[key] };
    const pushSubscriptionService = { findByUserId, removeById };
    const service = new PushNotificationService(
      configService as never,
      pushSubscriptionService as never,
    );
    service.onModuleInit();
    return service;
  }

  beforeEach(() => {
    jest.mocked(webpush.setVapidDetails).mockReset();
    sendNotification = jest.mocked(webpush.sendNotification);
    sendNotification.mockReset().mockResolvedValue({
      statusCode: 201,
      body: '',
      headers: {},
    });
  });

  const FULL_VAPID_CONFIG = {
    VAPID_PUBLIC_KEY: 'public-key',
    VAPID_PRIVATE_KEY: 'private-key',
    VAPID_SUBJECT: 'mailto:contact@urbanflow-mobility.example',
  };

  it('configure les cles VAPID au demarrage quand les trois variables sont presentes', () => {
    buildService(FULL_VAPID_CONFIG);

    expect(webpush.setVapidDetails).toHaveBeenCalledWith(
      'mailto:contact@urbanflow-mobility.example',
      'public-key',
      'private-key',
    );
  });

  it("ne configure pas VAPID et n'interroge pas les abonnements si la config est incomplete (degradation, pas de crash)", async () => {
    const service = buildService({ VAPID_PUBLIC_KEY: 'public-key' });

    await service.notifyUser('user-1', { title: 't', body: 'b' });

    expect(webpush.setVapidDetails).not.toHaveBeenCalled();
    expect(findByUserId).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("n'envoie rien si l'utilisateur n'a aucun abonnement", async () => {
    const service = buildService(FULL_VAPID_CONFIG);
    findByUserId.mockResolvedValue([]);

    await service.notifyUser('user-1', { title: 't', body: 'b' });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("envoie a chaque abonnement de l'utilisateur, avec le payload en JSON", async () => {
    const service = buildService(FULL_VAPID_CONFIG);
    const sub = buildSubscription();
    findByUserId.mockResolvedValue([sub]);

    await service.notifyUser('user-1', {
      title: 'Perturbation sur votre trajet',
      body: 'Votre ligne est perturbee.',
    });

    expect(sendNotification).toHaveBeenCalledWith(
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dhKey, auth: sub.authKey },
      },
      JSON.stringify({
        title: 'Perturbation sur votre trajet',
        body: 'Votre ligne est perturbee.',
      }),
    );
  });

  it(
    "l'echec d'un abonnement (erreur generique) n'empeche pas l'envoi aux " +
      'autres abonnements du meme utilisateur',
    async () => {
      const service = buildService(FULL_VAPID_CONFIG);
      const sub1 = buildSubscription({
        id: 'sub-1',
        endpoint: 'https://push.example/1',
      });
      const sub2 = buildSubscription({
        id: 'sub-2',
        endpoint: 'https://push.example/2',
      });
      findByUserId.mockResolvedValue([sub1, sub2]);
      sendNotification
        .mockRejectedValueOnce(new Error('reseau indisponible'))
        .mockResolvedValueOnce({ statusCode: 201, body: '', headers: {} });

      await service.notifyUser('user-1', { title: 't', body: 'b' });

      expect(sendNotification).toHaveBeenCalledTimes(2);
      expect(removeById).not.toHaveBeenCalled();
    },
  );

  it.each([404, 410])(
    'retire automatiquement un abonnement perime (statut %i)',
    async (statusCode) => {
      const service = buildService(FULL_VAPID_CONFIG);
      const sub = buildSubscription();
      findByUserId.mockResolvedValue([sub]);
      sendNotification.mockRejectedValue(
        new WebPushError('gone', statusCode, {}, '', sub.endpoint),
      );

      await service.notifyUser('user-1', { title: 't', body: 'b' });

      expect(removeById).toHaveBeenCalledWith('sub-1');
    },
  );

  it("ne retire pas l'abonnement pour une WebPushError autre que 404/410", async () => {
    const service = buildService(FULL_VAPID_CONFIG);
    const sub = buildSubscription();
    findByUserId.mockResolvedValue([sub]);
    sendNotification.mockRejectedValue(
      new WebPushError('server error', 500, {}, '', sub.endpoint),
    );

    await service.notifyUser('user-1', { title: 't', body: 'b' });

    expect(removeById).not.toHaveBeenCalled();
  });

  describe('getPublicKey', () => {
    it('renvoie la cle publique configuree', () => {
      const service = buildService(FULL_VAPID_CONFIG);
      expect(service.getPublicKey()).toBe('public-key');
    });

    it('renvoie null si aucune cle publique configuree', () => {
      const service = buildService({});
      expect(service.getPublicKey()).toBeNull();
    });
  });
});
