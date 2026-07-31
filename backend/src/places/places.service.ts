import { Injectable } from '@nestjs/common';
import { OtpClientService } from '../otp/otp-client.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import type { PlaceSuggestion } from './interfaces/place-suggestion.interface';

@Injectable()
export class PlacesService {
  constructor(private readonly otpClient: OtpClientService) {}

  /**
   * Recherche de lieux par texte (issue #81), pour l'autocompletion
   * origine/destination de l'ecran de recherche (#35). Delegue a OTP
   * (OtpClientService#geocode) - aucun resultat n'est un tableau vide,
   * jamais une erreur.
   */
  async search(dto: SearchPlacesDto): Promise<PlaceSuggestion[]> {
    const results = await this.otpClient.geocode(dto.query);

    return results.map((result) => ({
      label: result.description,
      lat: result.lat,
      lon: result.lng,
    }));
  }
}
