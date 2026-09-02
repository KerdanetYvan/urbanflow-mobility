import { ApiProperty } from '@nestjs/swagger';

/**
 * Nature d'une entree GBFS (issue #13) : une station a quai fixe
 * (station_information/station_status - velos STAR a Rennes) ou un vehicule
 * en free-floating (free_bike_status - trottinettes en libre-service sans
 * station, non encore couvert par l'operateur retenu mais pris en charge par
 * le connecteur pour rester generique a un futur flux qui l'exposerait).
 */
export type SharedMobilityKind = 'station' | 'vehicle';

/**
 * Forme unifiee renvoyee par GET /shared-mobility-stations (issue #13,
 * F3) - une station ou un vehicule en libre-service, quelle que soit
 * l'operateur/le flux GBFS d'origine. Voir GbfsClientService pour le detail
 * de la traduction depuis le standard GBFS.
 */
export class SharedMobilityStation {
  @ApiProperty({
    description:
      "Identifiant stable cote operateur (station_id ou bike_id du flux GBFS) - unique au sein d'un operateur, PAS forcement entre operateurs (voir operatorId pour lever toute ambiguite si plusieurs operateurs sont configures, issue #15).",
    example: '5501',
  })
  id: string;

  @ApiProperty({
    description:
      "Identifiant de l'operateur source (MobilityOperatorConfig#id, issue #15) - permet de distinguer deux stations qui partageraient le meme id entre deux operateurs differents une fois leurs flux fusionnes.",
    example: 'star-rennes',
  })
  operatorId: string;

  @ApiProperty({
    required: false,
    description:
      "Nom de la station (absent pour un vehicule en free-floating, qui n'en a pas dans le standard GBFS)",
    example: 'République',
  })
  name?: string;

  @ApiProperty()
  lat: number;

  @ApiProperty()
  lon: number;

  @ApiProperty({
    enum: ['station', 'vehicle'],
    description:
      "'station' = quai fixe (station_information/station_status), 'vehicle' = free-floating (free_bike_status)",
    example: 'station',
  })
  kind: SharedMobilityKind;

  @ApiProperty({
    description:
      "Nombre de velos/trottinettes disponibles a l'instant (1 pour un vehicule en free-floating, isole)",
    example: 4,
  })
  bikesAvailable: number;

  @ApiProperty({
    required: false,
    description:
      'Nombre de places libres pour deposer un velo (station a quai fixe uniquement, absent pour un vehicule en free-floating)',
    example: 12,
  })
  docksAvailable?: number;

  @ApiProperty({
    description:
      "false = station/vehicule hors service (maintenance, fermeture) - a afficher differemment cote carte plutot qu'a masquer, pour ne pas laisser croire a une absence de station",
    example: true,
  })
  isRenting: boolean;
}
