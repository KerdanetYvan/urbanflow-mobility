import { Injectable } from '@nestjs/common';
import { AccessibilityPreference } from '../profiles/accessibility-preference.enum';
import { MobilityProfile } from '../profiles/mobility-profile.entity';
import type {
  TripItinerary,
  TripSegment,
} from '../trips/dto/trip-itinerary.dto';
import type { CurrentWeather } from '../weather/weather.service';
import { WeatherService } from '../weather/weather.service';
import {
  OTP_MODE_TO_TRANSPORT_MODE,
  SCORING_WEIGHTS,
} from './scoring-weights.const';

/**
 * Classement pondere des itineraires (issue #16, partie 7.3 du dossier) :
 * calcule un score "cout" par itineraire (plus bas = meilleur) a partir de
 * SCORING_WEIGHTS, des preferences du profil de mobilite (si fourni) et de
 * la meteo en cours (issue #17). Seule dependance injectee : WeatherService
 * - conforme au diagramme de communication du dossier (partie 8.3), qui
 * place l'appel meteo depuis le service de scoring lui-meme, seul point de
 * contact avec les sources externes (meteo, GTFS-Realtime).
 */
@Injectable()
export class ScoringService {
  constructor(private readonly weatherService: WeatherService) {}

  /**
   * Trie les itineraires du meilleur au moins bon (score croissant). Ne
   * mute jamais le tableau/les objets recus (nouveau tableau, tri stable) et
   * n'ajoute aucun champ aux itineraires - la forme de TripItinerary reste
   * inchangee, conformement au sequencement deja annonce cote frontend (voir
   * TripsService/TripsController).
   *
   * Interroge la meteo une seule fois par appel (pas par itineraire) -
   * WeatherService la met deja en cache, mais autant eviter les appels
   * redondants au sein d'un meme classement.
   */
  async rank(
    itineraries: TripItinerary[],
    profile: MobilityProfile | null,
  ): Promise<TripItinerary[]> {
    const weather = await this.weatherService.getCurrentConditions();
    return [...itineraries].sort(
      (a, b) =>
        this.computeScore(a, profile, weather) -
        this.computeScore(b, profile, weather),
    );
  }

  private computeScore(
    itinerary: TripItinerary,
    profile: MobilityProfile | null,
    weather: CurrentWeather | null,
  ): number {
    let score =
      itinerary.durationSeconds * SCORING_WEIGHTS.DURATION_PER_SECOND +
      itinerary.transfers * this.transferWeight(profile);

    if (
      profile?.accessibilityPreferences.includes(
        AccessibilityPreference.LIMIT_WALKING_DISTANCE,
      )
    ) {
      score +=
        this.walkingDistanceMeters(itinerary) *
        SCORING_WEIGHTS.WALKING_METER_WHEN_LIMITED;
    }

    // Critere de base (pas une preference de profil, voir partie 7.2 du
    // dossier) : s'applique a tous les itineraires des qu'il pleut fort,
    // que l'utilisateur soit connecte ou non.
    if (
      weather &&
      weather.precipitationMm >= SCORING_WEIGHTS.RAIN_THRESHOLD_MM
    ) {
      score +=
        this.walkingDistanceMeters(itinerary) *
        SCORING_WEIGHTS.WALKING_METER_WHEN_RAINING;
    }

    if (profile) {
      score += this.preferredModeBonus(itinerary, profile);
    }

    return score;
  }

  /**
   * Cout par correspondance : amplifie par TRANSFER_MULTIPLIER_WHEN_LIMITED
   * si le profil demande explicitement de limiter les correspondances
   * (AccessibilityPreference.LIMIT_TRANSFERS), sinon le cout de base
   * s'applique - y compris sans profil (recherche anonyme).
   */
  private transferWeight(profile: MobilityProfile | null): number {
    const limited = profile?.accessibilityPreferences.includes(
      AccessibilityPreference.LIMIT_TRANSFERS,
    );
    return limited
      ? SCORING_WEIGHTS.TRANSFER *
          SCORING_WEIGHTS.TRANSFER_MULTIPLIER_WHEN_LIMITED
      : SCORING_WEIGHTS.TRANSFER;
  }

  /**
   * Somme des distances des segments a pied (issue #16). Reste WALK
   * uniquement pour l'instant : OtpClientService.buildPlanUrl restreint la
   * requete a "TRANSIT,WALK" (voir scoring-weights.const.ts), aucun segment
   * BICYCLE ne peut donc apparaitre avant l'integration GBFS - le malus
   * meteo (issue #17) s'appliquera automatiquement a la marche ET au velo
   * ce jour-la, sans modifier cette methode.
   */
  private walkingDistanceMeters(itinerary: TripItinerary): number {
    return itinerary.segments
      .filter((segment) => segment.mode === 'WALK')
      .reduce((total, segment) => total + segment.distanceMeters, 0);
  }

  /**
   * Bonus (negatif) pour chaque segment dont le mode OTP correspond a un
   * mode present dans preferredTransportModes - voir
   * OTP_MODE_TO_TRANSPORT_MODE pour la correspondance et ses limites (seuls
   * WALK/BUS/TRAM/SUBWAY/RAIL peuvent apparaitre aujourd'hui).
   */
  private preferredModeBonus(
    itinerary: TripItinerary,
    profile: MobilityProfile,
  ): number {
    const matchingSegments = itinerary.segments.filter(
      (segment: TripSegment) => {
        const transportMode = OTP_MODE_TO_TRANSPORT_MODE[segment.mode];
        return (
          transportMode !== undefined &&
          profile.preferredTransportModes.includes(transportMode)
        );
      },
    );
    return (
      matchingSegments.length * SCORING_WEIGHTS.PREFERRED_MODE_BONUS_PER_SEGMENT
    );
  }
}
