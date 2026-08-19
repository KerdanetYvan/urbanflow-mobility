import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Version typee de l'interface ValueTransformer de TypeORM (dont `to`/`from`
 * sont declares en `any` des deux cotes) - structurellement compatible avec
 * elle (assignable a `@Column({ transformer: ... })`), mais evite de
 * propager de l'`any` non verifie jusque dans les appelants directs (voir le
 * .spec.ts associe, qui appelle to()/from() sans passer par TypeORM).
 */
interface TypedValueTransformer<T> {
  to(value: T | null | undefined): string | null | undefined;
  from(value: string | null | undefined): T | null | undefined;
}

/**
 * Chiffrement au repos des donnees de geolocalisation (RGPD, issue #22,
 * docs/specs/rgpd-geolocalisation.md) : mecanisme reutilisable, construit
 * AVANT toute colonne concrete qui en a besoin - aucune donnee de
 * geolocalisation n'est encore persistee aujourd'hui (l'historique des
 * trajets, issue #11, et les adresses domicile/travail, issue #113, ne sont
 * pas encore implementes). Objectif : que #11/#113 n'aient plus qu'a
 * appliquer ce transformer a leurs nouvelles colonnes, sans jamais ouvrir de
 * fenetre ou des coordonnees seraient stockees en clair.
 *
 * AES-256-GCM (chiffrement authentifie) plutot qu'un mode non authentifie
 * (CBC...) : detecte toute alteration du texte chiffre au dechiffrement
 * (verification du tag d'authentification, voir decrypt ci-dessous) plutot
 * que de renvoyer silencieusement des donnees corrompues.
 */

const ALGORITHM = 'aes-256-gcm';
/** 12 octets recommandes pour GCM (NIST SP 800-38D) - pas la taille de bloc AES (16). */
const IV_LENGTH_BYTES = 12;

/**
 * Cle de chiffrement, lue a chaque appel plutot que mise en cache au chargement
 * du module : permet aux tests de la faire varier (voir le .spec.ts associe)
 * sans recharger le module. Attendue en base64, decodee en exactement 32
 * octets (AES-256) - erreur explicite plutot qu'un chiffrement silencieusement
 * affaibli si la variable est absente ou mal dimensionnee.
 */
function getEncryptionKey(): Buffer {
  const encoded = process.env.GEOLOCATION_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error(
      "GEOLOCATION_ENCRYPTION_KEY manquante - requise des qu'une colonne " +
        'utilise createEncryptedColumnTransformer (voir docs/specs/rgpd-geolocalisation.md)',
    );
  }
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error(
      'GEOLOCATION_ENCRYPTION_KEY doit decoder en exactement 32 octets ' +
        '(AES-256) une fois interpretee en base64 - generer avec ' +
        '`openssl rand -base64 32`',
    );
  }
  return key;
}

/**
 * Chiffre `plaintext` et renvoie une chaine imprimable combinant IV, tag
 * d'authentification et texte chiffre (chacun en base64, separes par ":") -
 * un format auto-suffisant, pas besoin de colonnes supplementaires pour
 * stocker l'IV a part.
 */
function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext]
    .map((buffer) => buffer.toString('base64'))
    .join(':');
}

/**
 * Dechiffre une chaine produite par encrypt(). Leve une erreur (plutot que
 * de renvoyer une valeur corrompue) si le tag d'authentification ne
 * correspond pas - donnee alteree ou mauvaise cle.
 */
function decrypt(payload: string): string {
  const [ivB64, authTagB64, ciphertextB64] = payload.split(':');
  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Transformer TypeORM generique de chiffrement au repos - a utiliser sur
 * toute future colonne portant une donnee de geolocalisation (issue #22) :
 *
 * ```ts
 * @Column({ type: 'text', transformer: createEncryptedColumnTransformer<number>() })
 * originLat: number;
 * ```
 *
 * La colonne DOIT etre typee `text` cote Postgres (le texte chiffre est une
 * chaine base64, pas la representation native du type applicatif) - TypeORM
 * applique `to()` a l'ecriture (valeur applicative -> texte chiffre stocke)
 * et `from()` a la lecture (texte chiffre lu -> valeur applicative), de
 * facon totalement transparente pour le reste du code (repositories,
 * services) qui continue de manipuler des `number`/`string` normaux.
 *
 * Generique (`<T>`) plutot que specialise a `number` : passe par une
 * serialisation JSON interne, fonctionne donc aussi bien pour un nombre
 * (coordonnee) que pour une chaine (adresse textuelle, #113).
 */
export function createEncryptedColumnTransformer<
  T,
>(): TypedValueTransformer<T> {
  return {
    to(value: T | null | undefined): string | null | undefined {
      // Cast explicite plutot qu'un simple `return value` : le
      // retrecissement de type de TypeScript sur un generique non
      // contraint (T) ne narrow pas correctement value vers `null |
      // undefined` dans cette branche (limitation connue, sans lien avec
      // un vrai risque a l'execution - le test d'egalite ci-dessus l'a
      // deja garanti).
      if (value === null || value === undefined) {
        return value as null | undefined;
      }
      return encrypt(JSON.stringify(value));
    },
    from(value: string | null | undefined): T | null | undefined {
      // Pas besoin du meme cast qu'au-dessus : le retrecissement fonctionne
      // normalement ici (value n'est pas de type generique).
      if (value === null || value === undefined) return value;
      return JSON.parse(decrypt(value)) as T;
    },
  };
}
