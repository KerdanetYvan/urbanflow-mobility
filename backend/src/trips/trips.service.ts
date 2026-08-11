import { Injectable } from '@nestjs/common';
import { SearchTripsDto } from './dto/search-trips.dto';
import type {
  OtpItinerary,
  OtpLeg,
} from '../otp/interfaces/otp-plan-response.interface';
import type {
  GeoPoint,
  TripItinerary,
  TripSegment,
} from './dto/trip-itinerary.dto';
import { OtpClientService } from '../otp/otp-client.service';
import { decodePolyline } from '../otp/polyline';
import { ProfilesService } from '../profiles/profiles.service';
import { ScoringService } from '../scoring/scoring.service';

@Injectable()
export class TripsService {
  constructor(
    private readonly otpClient: OtpClientService,
    private readonly profilesService: ProfilesService,
    private readonly scoringService: ScoringService,
  ) {}

  /**
   * Recherche d'itineraires multimodaux (issue #7). Delegue le calcul a OTP
   * (OtpClientService, issue #6), reformate sa reponse en segments, puis
   * classe le resultat par score pondere (ScoringService, issue #16) -
   * aucune erreur specifique a gerer ici au-dela de ce que OtpClientService
   * a deja traduit (jetons hors zone -> BadRequestException, OTP
   * injoignable -> ServiceUnavailableException) : un tableau vide est un
   * resultat normal ("aucun itineraire trouve", pas une erreur - voir
   * docs/specs/f2-ecrans-planification.md section 4).
   *
   * `userId` est optionnel (voir TripsController - GET /trips reste
   * utilisable sans compte, OptionalJwtAuthGuard) : sans profil disponible,
   * ScoringService applique uniquement ses criteres de base (duree,
   * correspondances), proche du tri natif d'OTP.
   */
  async search(dto: SearchTripsDto, userId?: string): Promise<TripItinerary[]> {
    const [itineraries, profile] = await Promise.all([
      this.otpClient.planTrip({
        originLat: dto.originLat,
        originLon: dto.originLon,
        destinationLat: dto.destinationLat,
        destinationLon: dto.destinationLon,
        departureTime: dto.departureTime
          ? new Date(dto.departureTime)
          : undefined,
      }),
      userId ? this.profilesService.findByUserIdOrNull(userId) : null,
    ]);

    const mapped = itineraries.map((itinerary) => this.mapItinerary(itinerary));
    return this.scoringService.rank(mapped, profile);
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
      geometry: this.mapGeometry(leg),
    };
  }

  /**
   * Trace detaille du segment (issue #8), decode depuis legGeometry.points
   * (verifie contre un vrai OTP - toujours present en pratique). Repli sur
   * une simple ligne [from, to] si absent, pour ne jamais faire planter la
   * recherche a cause d'un champ manquant sur un leg particulier.
   */
  private mapGeometry(leg: OtpLeg): GeoPoint[] {
    if (!leg.legGeometry?.points) {
      return [
        { lat: leg.from.lat, lon: leg.from.lon },
        { lat: leg.to.lat, lon: leg.to.lon },
      ];
    }
    return decodePolyline(leg.legGeometry.points);
  }
}
