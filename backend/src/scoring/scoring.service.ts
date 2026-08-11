import { Injectable } from '@nestjs/common';
import { AccessibilityPreference } from '../profiles/accessibility-preference.enum';
import { MobilityProfile } from '../profiles/mobility-profile.entity';
import type {
  TripItinerary,
  TripSegment,
} from '../trips/dto/trip-itinerary.dto';
import {
  OTP_MODE_TO_TRANSPORT_MODE,
  SCORING_WEIGHTS,
} from './scoring-weights.const';

/**
 * Classement pondere des itineraires (issue #16, partie 7.3 du dossier) :
 * calcule un score "cout" par itineraire (plus bas = meilleur) a partir de
 * SCORING_WEIGHTS et, si fourni, des preferences du profil de mobilite de
 * l'utilisateur. Aucune dependance injectee - fonction pure sur ses
 * arguments, testable sans TestingModule ni mock.
 */
@Injectable()
export class ScoringService {
  /**
   * Trie les itineraires du meilleur au moins bon (score croissant). Ne
   * mute jamais le tableau/les objets recus (nouveau tableau, tri stable) et
   * n'ajoute aucun champ aux itineraires - la forme de TripItinerary reste
   * inchangee, conformement au sequencement deja annonce cote frontend (voir
   * TripsService/TripsController).
   */
  rank(
    itineraries: TripItinerary[],
    profile: MobilityProfile | null,
  ): TripItinerary[] {
    return [...itineraries].sort(
      (a, b) => this.computeScore(a, profile) - this.computeScore(b, profile),
    );
  }

  private computeScore(
    itinerary: TripItinerary,
    profile: MobilityProfile | null,
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
