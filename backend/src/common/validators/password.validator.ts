/**
 * Regle de mot de passe partagee entre l'inscription (CreateUserDto) et la
 * reinitialisation (ResetPasswordDto, issue #70) - extrait ici plutot que
 * duplique pour eviter que les deux DTO divergent silencieusement sur une
 * regex de securite.
 *
 * Au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un
 * caractere special. Ecrit en 4 lookaheads independants (?=...) plutot
 * qu'une seule expression complexe : chacun verifie la presence d'une
 * categorie sans consommer de caracteres, la longueur minimale etant
 * verifiee par le `.{8,}` final. Coherent avec la regle appliquee cote
 * frontend (voir ConnexionPage.tsx) - meme message des deux cotes.
 */
export const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
export const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special';
