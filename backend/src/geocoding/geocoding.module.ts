import { Module } from '@nestjs/common';
import { NominatimClientService } from './nominatim-client.service';

/**
 * Client Nominatim partagé (issue #167/#168) - pour l'instant seul
 * PlacesModule s'en sert (géocodage d'adresses en complément d'OTP), mais
 * un futur endpoint de reverse geocoding de la position GPS (voir spec §6)
 * le réutiliserait. Même motif qu'OtpModule.
 */
@Module({
  providers: [NominatimClientService],
  exports: [NominatimClientService],
})
export class GeocodingModule {}
