import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** Parametres de GET /places (issue #81) : texte tape par l'utilisateur dans le champ origine/destination. */
export class SearchPlacesDto {
  @ApiProperty({ example: 'Gare' })
  @IsString()
  @IsNotEmpty()
  query: string;
}
