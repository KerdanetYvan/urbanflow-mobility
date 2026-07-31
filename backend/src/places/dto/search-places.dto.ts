import { IsNotEmpty, IsString } from 'class-validator';

/** Parametres de GET /places (issue #81) : texte tape par l'utilisateur dans le champ origine/destination. */
export class SearchPlacesDto {
  @IsString()
  @IsNotEmpty()
  query: string;
}
