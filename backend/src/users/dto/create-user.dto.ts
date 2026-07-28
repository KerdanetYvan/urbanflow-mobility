import { IsEmail, Matches } from 'class-validator';

/**
 * Au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un
 * caractere special. Ecrit en 4 lookaheads independants (?=...) plutot
 * qu'une seule expression complexe : chacun verifie la presence d'une
 * categorie sans consommer de caracteres, la longueur minimale etant
 * verifiee par le `.{8,}` final. Coherent avec la regle appliquee cote
 * frontend (voir ConnexionPage.tsx) - meme message des deux cotes.
 */
const PASSWORD_PATTERN =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
const PASSWORD_MESSAGE =
  'Le mot de passe doit contenir au moins 8 caracteres, une majuscule, une minuscule, un chiffre et un caractere special';

/**
 * Donnees attendues pour POST /users (inscription).
 *
 * class-validator verifie automatiquement ce DTO grace au ValidationPipe
 * global (voir main.ts) : une requete avec un email invalide ou un mot de
 * passe trop faible est rejetee en 400 avant meme d'atteindre le controleur,
 * avec un message d'erreur par champ (voir AllExceptionsFilter, qui sait
 * deja gerer ce format de message en tableau).
 */
export class CreateUserDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  @Matches(PASSWORD_PATTERN, { message: PASSWORD_MESSAGE })
  password: string;
}
