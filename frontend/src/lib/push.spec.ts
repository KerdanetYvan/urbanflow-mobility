import { afterEach, describe, expect, it, vi } from 'vitest';

// getVapidPublicKey (dans push.ts) passe par apiGet - on mocke la couche
// reseau pour piloter la reponse GET /push/vapid-public-key.
vi.mock('./api', () => ({
  apiGet: vi.fn(),
  authPost: vi.fn(),
  authDelete: vi.fn(),
}));

import { apiGet } from './api';
import { subscribeBrowserToPush } from './push';

const mockedApiGet = vi.mocked(apiGet);

/**
 * Installe un environnement navigateur complet et fonctionnel pour l'API
 * Push (jsdom n'en fournit aucune primitive). Chaque test part de cet etat
 * "tout va bien" et ne stubbe que ce qu'il veut faire echouer.
 */
function stubWorkingPushEnv(options: {
  permission?: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
  subscribeImpl?: () => unknown;
} = {}) {
  const requestPermission = vi
    .fn()
    .mockResolvedValue(options.requestPermissionResult ?? 'granted');
  vi.stubGlobal('Notification', {
    permission: options.permission ?? 'default',
    requestPermission,
  });
  vi.stubGlobal('PushManager', class {});

  const subscribe = vi.fn(
    options.subscribeImpl ??
      (() => ({
        toJSON: () => ({
          endpoint: 'https://push.example/endpoint-1',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        }),
      })),
  );
  vi.stubGlobal('navigator', {
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { subscribe } }),
    },
  });

  // apiGet renvoie une cle VAPID valide par defaut.
  mockedApiGet.mockResolvedValue({ publicKey: 'BValidVapidPublicKey' });

  return { requestPermission, subscribe };
}

describe('subscribeBrowserToPush (issue #277 - causes distinctes)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("status 'unsupported' si le navigateur n'a pas l'API Push", async () => {
    // navigator sans serviceWorker, pas de PushManager global.
    vi.stubGlobal('navigator', {});
    mockedApiGet.mockResolvedValue({ publicKey: 'BValidVapidPublicKey' });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'unsupported',
    });
  });

  it("status 'server-unconfigured' si GET /push/vapid-public-key renvoie null", async () => {
    stubWorkingPushEnv();
    mockedApiGet.mockResolvedValue({ publicKey: null });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'server-unconfigured',
    });
  });

  it("status 'permission-blocked' si Notification.permission vaut deja 'denied' (refus memorise)", async () => {
    const { requestPermission } = stubWorkingPushEnv({ permission: 'denied' });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'permission-blocked',
    });
    // On ne redemande meme pas : le navigateur ne reafficherait rien.
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it("status 'permission-denied' si l'utilisateur refuse dans la demande affichee a l'instant", async () => {
    stubWorkingPushEnv({
      permission: 'default',
      requestPermissionResult: 'denied',
    });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'permission-denied',
    });
  });

  it("status 'permission-dismissed' si la demande est fermee sans choix ('default')", async () => {
    stubWorkingPushEnv({
      permission: 'default',
      requestPermissionResult: 'default',
    });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'permission-dismissed',
    });
  });

  it("status 'subscribed' avec l'abonnement quand tout aboutit", async () => {
    stubWorkingPushEnv();

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'subscribed',
      subscription: {
        endpoint: 'https://push.example/endpoint-1',
        keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
      },
    });
  });

  it("status 'error' si pushManager.subscribe() echoue malgre la permission accordee", async () => {
    stubWorkingPushEnv({
      subscribeImpl: () => {
        throw new Error('subscribe failed');
      },
    });

    await expect(subscribeBrowserToPush()).resolves.toEqual({
      status: 'error',
    });
  });
});
