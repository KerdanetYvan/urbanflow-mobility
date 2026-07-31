/**
 * Construit une chaine qui a la FORME d'un JWT (header.payload.signature,
 * payload en base64url decodable) sans signature reelle - suffisant pour
 * tester le decodage cote client du claim `exp` (voir
 * lib/authStorage.ts#hasValidSession), qui ne verifie jamais la signature de
 * toute facon (seul le backend fait foi). Ne PAS utiliser pour simuler un
 * jeton envoye a une vraie API.
 */
export function fakeJwt(expiresInSeconds: number): string {
  const payload = { exp: Math.floor(Date.now() / 1000) + expiresInSeconds };
  const base64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `header.${base64}.signature`;
}
