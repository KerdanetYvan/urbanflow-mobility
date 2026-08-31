import { ApiProperty } from '@nestjs/swagger';

/** Nature d'une suggestion (issue #168) : arret de transport (source OTP) ou adresse postale (source Nominatim). */
export type PlaceKind = 'stop' | 'address';

/** Forme renvoyee par GET /places (issue #81, enrichi #168) - une suggestion de lieu. */
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

  @ApiProperty({
    enum: ['stop', 'address'],
    description:
      "'stop' = arret de transport (geocodeur OTP), 'address' = adresse postale (Nominatim). Sert au frontend a distinguer les deux (icone).",
    example: 'stop',
  })
  kind: PlaceKind;
}
