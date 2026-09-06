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

/**
 * Claims supplementaires portes UNIQUEMENT par le refresh token (issue #268,
 * rotation stricte) : `jti` identifie ce refresh token precis, `fam` sa
 * famille de session. L'access token reste un simple `{ sub, email }` - ces
 * champs n'ont de sens que face a la table `refresh_tokens`.
 */
export interface RefreshTokenPayload extends JwtPayload {
  jti: string;
  fam: string;
}
