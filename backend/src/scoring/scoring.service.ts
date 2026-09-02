import { Injectable } from '@nestjs/common';
import { GtfsRealtimeCacheService } from '../gtfs-realtime/gtfs-realtime-cache.service';
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
 * SCORING_WEIGHTS, des preferences du profil de mobilite (si fourni), de la
 * meteo en cours (issue #17) et des perturbations GTFS-Realtime en cours
 * (issue #18). Deux dependances injectees, conformes au diagramme de
 * communication du dossier (partie 8.3) qui place ces deux appels (meteo,
 * GTFS-Realtime) depuis le service de scoring lui-meme : WeatherService et
 * GtfsRealtimeCacheService (cache deja rafraichi en tache de fond par
 * GtfsRealtimeModule, jamais interroge a la volee ici).
 */
@Injectable()
export class ScoringService {
  constructor(
    private readonly weatherService: WeatherService,
    private readonly gtfsRealtimeCache: GtfsRealtimeCacheService,
  ) {}

  /**
   * Trie les itineraires du meilleur au moins bon (score croissant). Ne
   * mute jamais le tableau/les objets recus (nouveau tableau, itineraires
   * copies) - seul ajout au passage : `disrupted: true` sur tout itineraire
   * touche par une perturbation GTFS-Realtime en cours (issue #18, voir
   * TripItinerary#disrupted), absent (pas juste `false`) sinon. Tri stable
   * a egalite de score.
   *
   * Interroge la meteo une seule fois par appel (pas par itineraire) -
   * WeatherService la met deja en cache, mais autant eviter les appels
   * redondants au sein d'un meme classement. GtfsRealtimeCacheService n'est
   * lui jamais interroge en reseau (cache memoire local, voir sa docstring).
   */
  async rank(
    itineraries: TripItinerary[],
    profile: MobilityProfile | null,
  ): Promise<TripItinerary[]> {
    const weather = await this.weatherService.getCurrentConditions();
    return itineraries
      .map((itinerary) => {
        const disrupted = this.hasActiveDisruption(itinerary);
        // Etale d'abord l'itineraire recu (jamais mute), `disrupted`
        // ajoute seulement si vrai - voir TripItinerary#disrupted, pas de
        // champ present-mais-false pour ne pas alourdir les itineraires
        // (grande majorite) qui n'en ont pas besoin.
        return disrupted ? { ...itinerary, disrupted } : { ...itinerary };
      })
      .sort(
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

    // `disrupted` deja calcule par rank() (voir hasActiveDisruption) avant
    // l'appel a computeScore - relu ici plutot que recalcule, un seul appel
    // a hasActiveDisruption par itineraire et par classement.
    if (itinerary.disrupted) {
      score += SCORING_WEIGHTS.PERTURBATION_PENALTY;
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

  /**
   * `true` si au moins un segment de transport en commun de l'itineraire
   * est actuellement touche par une perturbation GTFS-Realtime (issue #18) -
   * recoupe route_id/trip_id de chaque segment (TripSegment#routeId/tripId,
   * issue #18) avec GtfsRealtimeCacheService#findDisruptions (issue #14).
   * Un segment a pied n'a ni routeId ni tripId : `findDisruptions({})`
   * renvoie deliberement `[]` sans routeId/tripId (voir sa docstring), donc
   * jamais de faux positif sur ces segments.
   */
  private hasActiveDisruption(itinerary: TripItinerary): boolean {
    return itinerary.segments.some(
      (segment) =>
        this.gtfsRealtimeCache.findDisruptions({
          routeId: segment.routeId,
          tripId: segment.tripId,
        }).length > 0,
    );
  }
}
