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
import { TripHistoryService } from './history/trip-history.service';

@Injectable()
export class TripsService {
  constructor(
    private readonly otpClient: OtpClientService,
    private readonly profilesService: ProfilesService,
    private readonly scoringService: ScoringService,
    private readonly tripHistoryService: TripHistoryService,
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
    // L'enregistrement de l'historique (issue #11) est lance en parallele du
    // reste - il n'a besoin ni du resultat OTP ni du profil, et
    // TripHistoryService#record avale ses propres erreurs (ne peut jamais
    // faire echouer la recherche). Absent (userId undefined) : recherche non
    // authentifiee, rien a historiser (voir OptionalJwtAuthGuard).
    const [itineraries, profile] = await Promise.all([
      this.otpClient.planTrip({
        originLat: dto.originLat,
        originLon: dto.originLon,
        destinationLat: dto.destinationLat,
        destinationLon: dto.destinationLon,
        departureTime: dto.departureTime
          ? new Date(dto.departureTime)
          : undefined,
        // Filtre de modes préférés (issue #87) - transmis tel quel, la
        // traduction en paramètre OTP est faite par OtpClientService.
        transportModes: dto.transportModes,
      }),
      userId ? this.profilesService.findByUserIdOrNull(userId) : null,
      userId ? this.tripHistoryService.record(userId, dto) : null,
    ]);

    const mapped = itineraries.map((itinerary) => this.mapItinerary(itinerary));
    const grouped = this.groupByRoute(mapped);
    return this.scoringService.rank(grouped, profile);
  }

  /**
   * Regroupe les itineraires strictement identiques (meme succession de
   * mode/ligne/arrets, hors horaire) sous un seul resultat (issue #127) -
   * evite d'afficher jusqu'a 5 fois le meme trajet a des horaires
   * differents quand une seule ligne dessert la demande (OTP renvoie ses
   * numItineraries prochains departs sans deduplication, voir
   * OtpClientService). Fait AVANT le passage au scoring (ScoringService,
   * issue #16) : celui-ci continue de recevoir un itineraire par resultat
   * distinct affiche, pas un par horaire - sinon des departs identiques
   * auraient pese plusieurs fois plus lourd dans le classement final sans
   * que ca se reflete dans l'affichage.
   *
   * L'itineraire dont le depart est le plus proche sert de representant
   * (celui affiche/detaille) ; les horaires de tous les membres du groupe
   * sont exposes via `nextDepartures` (tries par ordre chronologique).
   * Ce champ reste absent quand le groupe n'a qu'un seul membre, pour ne
   * rien changer au contrat existant quand aucun regroupement n'a lieu
   * (dernier critere d'acceptation de #127).
   */
  private groupByRoute(itineraries: TripItinerary[]): TripItinerary[] {
    const groups = new Map<string, TripItinerary[]>();
    for (const itinerary of itineraries) {
      const key = this.routeKey(itinerary);
      const group = groups.get(key);
      if (group) {
        group.push(itinerary);
      } else {
        groups.set(key, [itinerary]);
      }
    }

    return Array.from(groups.values()).map((group) => {
      if (group.length === 1) {
        return group[0];
      }
      const sorted = [...group].sort(
        (a, b) => Date.parse(a.startTime) - Date.parse(b.startTime),
      );
      return {
        ...sorted[0],
        nextDepartures: sorted.map((itinerary) => itinerary.startTime),
      };
    });
  }

  /**
   * Cle de regroupement d'un itineraire (voir groupByRoute) : suite
   * ordonnee de (mode, ligne, arret de depart, arret d'arrivee) par
   * segment - suffisant pour distinguer deux trajets reellement differents
   * (itineraire alternatif, correspondance differente) sans dependre d'un
   * identifiant GTFS route_id qu'OTP ne renvoie pas dans notre integration
   * (voir OtpLeg).
   */
  private routeKey(itinerary: TripItinerary): string {
    return itinerary.segments
      .map(
        (segment) =>
          `${segment.mode}|${segment.routeName ?? ''}|${segment.from.name}|${segment.to.name}`,
      )
      .join('>');
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
      // Couleur de ligne (issue #129, section 8) - relayee telle quelle
      // (pas de transformation, le frontend prefixe '#' au moment de
      // l'affichage, voir frontend/src/lib/color.ts).
      routeColor: leg.routeColor || undefined,
      routeTextColor: leg.routeTextColor || undefined,
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
