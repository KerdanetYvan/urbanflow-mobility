import { IsEmail, IsNotEmpty } from 'class-validator';

/** Donnees attendues pour POST /auth/login. */
export class LoginDto {
  @IsEmail({}, { message: 'Adresse email invalide' })
  email: string;

  /**
   * Pas de @MinLength ici volontairement : on ne veut pas donner d'indice
   * sur la politique de mot de passe a quelqu'un qui essaie de se connecter
   * (contrairement a l'inscription, ou c'est utile a l'utilisateur legitime).
   */
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  password: string;
}
