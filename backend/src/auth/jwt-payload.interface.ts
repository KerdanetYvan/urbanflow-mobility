/**
 * Contenu (payload) encode dans les JWT d'acces et de rafraichissement.
 * `sub` (subject) est le nom standard JWT pour l'identifiant du sujet du
 * token, ici l'id utilisateur - convention reprise telle quelle plutot que
 * d'inventer un nom de champ maison.
 */
export interface JwtPayload {
  sub: string;
  email: string;
}
