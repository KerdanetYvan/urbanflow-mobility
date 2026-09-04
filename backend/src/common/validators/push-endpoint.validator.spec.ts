import { validate } from 'class-validator';
import { IsPushEndpoint } from './push-endpoint.validator';

/**
 * DTO minimal pour exercer `@IsPushEndpoint()` via `class-validator`
 * (audit securite OWASP #262, API7 - SSRF sur SubscribePushDto.endpoint).
 */
class FakeEndpointDto {
  @IsPushEndpoint()
  endpoint: string;
}

async function isValidEndpoint(endpoint: string): Promise<boolean> {
  const dto = new FakeEndpointDto();
  dto.endpoint = endpoint;
  const errors = await validate(dto);
  return errors.length === 0;
}

describe('IsPushEndpoint', () => {
  it('accepte les hebergeurs de push connus (Chrome/FCM, Firefox, Safari)', async () => {
    expect(
      await isValidEndpoint('https://fcm.googleapis.com/fcm/send/abc123'),
    ).toBe(true);
    expect(
      await isValidEndpoint(
        'https://updates.push.services.mozilla.com/wpush/v2/xyz',
      ),
    ).toBe(true);
    expect(await isValidEndpoint('https://web.push.apple.com/QAA')).toBe(true);
  });

  it("accepte un sous-domaine direct d'un hebergeur autorise", async () => {
    expect(
      await isValidEndpoint('https://region1.fcm.googleapis.com/fcm/send/abc'),
    ).toBe(true);
  });

  it('rejette un hebergeur non reconnu (SSRF via URL arbitraire)', async () => {
    expect(await isValidEndpoint('https://attacker.example.com/collect')).toBe(
      false,
    );
  });

  it('rejette les cibles reseau interne meme avec un chemin trompeur', async () => {
    expect(await isValidEndpoint('https://localhost:8080/internal')).toBe(
      false,
    );
    expect(
      await isValidEndpoint('https://169.254.169.254/latest/meta-data'),
    ).toBe(false);
    expect(await isValidEndpoint('https://192.168.1.1/admin')).toBe(false);
  });

  it('rejette une usurpation de nom de domaine par sous-domaine trompeur', async () => {
    // "fcm.googleapis.com" comme PREFIXE d'un domaine attaquant, pas comme
    // hote reel - doit etre rejete (sinon toute la protection est
    // contournable par un simple sous-domaine cosmetique).
    expect(
      await isValidEndpoint('https://fcm.googleapis.com.attacker.test/x'),
    ).toBe(false);
  });

  it('rejette un schema non https (ex: http, file)', async () => {
    expect(
      await isValidEndpoint('http://fcm.googleapis.com/fcm/send/abc'),
    ).toBe(false);
  });

  it("rejette une valeur qui n'est pas une URL", async () => {
    expect(await isValidEndpoint('pas-une-url')).toBe(false);
  });
});
