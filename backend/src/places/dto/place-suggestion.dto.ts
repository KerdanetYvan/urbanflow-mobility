import { ApiProperty } from '@nestjs/swagger';

/** Forme renvoyee par GET /places (issue #81) - une suggestion de lieu. */
export class PlaceSuggestion {
  @ApiProperty({
    description: "Texte affichable dans la liste d'autocompletion",
    example: 'Gare Test',
  })
  label: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;
}
