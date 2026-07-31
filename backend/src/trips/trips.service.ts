import { Injectable } from '@nestjs/common';
import { SearchTripsDto } from './dto/search-trips.dto';
import type {
  OtpItinerary,
  OtpLeg,
} from './interfaces/otp-plan-response.interface';
import type {
  TripItinerary,
  TripSegment,
} from './interfaces/trip-itinerary.interface';
import { OtpClientService } from './otp-client.service';

@Injectable()
export class TripsService {
  constructor(private readonly otpClient: OtpClientService) {}

  /**
   * Recherche d'itineraires multimodaux (issue #7). Delegue le calcul a OTP
   * (OtpClientService, issue #6) et reformate sa reponse en segments -
   * aucune erreur specifique a gerer ici au-dela de ce que OtpClientService
   * a deja traduit (jetons hors zone -> BadRequestException, OTP
   * injoignable -> ServiceUnavailableException) : un tableau vide est un
   * resultat normal ("aucun itineraire trouve", pas une erreur - voir
   * docs/specs/f2-ecrans-planification.md section 4).
   *
   * Ordre de tri : natif OpenTripPlanner (duree croissante) pour l'instant -
   * le classement pondere (temps de trajet, correspondances, meteo...)
   * arrivera avec le service de scoring (issue #16, Sprint 3), sans
   * modification attendue cote frontend (voir la note de sequencement du
   * spec ecrans F2).
   */
  async search(dto: SearchTripsDto): Promise<TripItinerary[]> {
    const itineraries = await this.otpClient.planTrip({
      originLat: dto.originLat,
      originLon: dto.originLon,
      destinationLat: dto.destinationLat,
      destinationLon: dto.destinationLon,
      departureTime: dto.departureTime
        ? new Date(dto.departureTime)
        : undefined,
    });

    return itineraries.map((itinerary) => this.mapItinerary(itinerary));
  }

  private mapItinerary(itinerary: OtpItinerary): TripItinerary {
    return {
      startTime: new Date(itinerary.startTime).toISOString(),
      endTime: new Date(itinerary.endTime).toISOString(),
      durationSeconds: itinerary.duration,
      transfers: itinerary.transfers,
      segments: itinerary.legs.map((leg) => this.mapLeg(leg)),
    };
  }

  private mapLeg(leg: OtpLeg): TripSegment {
    return {
      mode: leg.mode,
      // routeShortName ("T1") plutot que route (nom long, "Ligne Test -
      // Boucle Centre") : ce que l'usager reconnait reellement (verifie en
      // testant contre un vrai OTP).
      routeName: leg.routeShortName || undefined,
      startTime: new Date(leg.startTime).toISOString(),
      endTime: new Date(leg.endTime).toISOString(),
      durationSeconds: Math.round((leg.endTime - leg.startTime) / 1000),
      distanceMeters: leg.distance,
      from: { name: leg.from.name, lat: leg.from.lat, lon: leg.from.lon },
      to: { name: leg.to.name, lat: leg.to.lat, lon: leg.to.lon },
    };
  }
}
