import { Injectable } from '@nestjs/common';
import { SearchTripsDto } from './dto/search-trips.dto';
import type {
  OtpItinerary,
  OtpLeg,
} from '../otp/interfaces/otp-plan-response.interface';
import type {
  GeoPoint,
  TripItinerary,
  TripSearchResult,
  TripSegment,
} from './dto/trip-itinerary.dto';
import { OtpClientService } from '../otp/otp-client.service';
import { decodePolyline } from '../otp/polyline';
import { ProfilesService } from '../profiles/profiles.service';
import { ScoringService } from '../scoring/scoring.service';
import { TripHistoryService } from './history/trip-history.service';

/**
 * Fenetre de recherche (en secondes) utilisee pour le repli "prochain
 * creneau disponible" (issue #91). 24h = borne raisonnable : couvre le cas
 * type (recherche apres le dernier depart du jour -> trajet le lendemain
 * matin) sans autoriser une recherche a plusieurs jours, et correspond au
 * `transit.maxSearchWindow` par defaut d'OTP 2.x (au-dela, OTP tronque de
 * toute facon). Un seul appel avec cette fenetre, jamais de boucle
 * (eco-conception, CLAUDE.md).
 */
const NEXT_SLOT_SEARCH_WINDOW_SECONDS = 24 * 60 * 60;

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
   *
   * Replis quand la recherche normale ne renvoie rien (au plus 2 appels OTP
   * supplementaires, et uniquement dans ce cas - eco-conception, CLAUDE.md) :
   * 1. Prochain creneau (issue #91) : on relance la meme recherche avec la
   *    fenetre OTP elargie a 24h. Si des trajets existent plus tard, on les
   *    renvoie avec `fallback: { kind: 'later-departure', requestedDepartureTime,
   *    actualDepartureTime }`.
   * 2. Repli a pied (issue #190) : sinon, on retente en `mode=WALK` seul. Un
   *    trajet a pied trouve est renvoye avec `fallback: { kind: 'walk-only' }`.
   * 3. Sinon, `{ itineraries: [] }` (etat vide "sec", message generique cote
   *    frontend).
   */
  async search(
    dto: SearchTripsDto,
    userId?: string,
  ): Promise<TripSearchResult> {
    // Parametres communs aux deux appels OTP possibles (recherche normale
    // puis, si besoin, repli a pied) - extraits pour ne pas les dupliquer.
    const planParams = {
      originLat: dto.originLat,
      originLon: dto.originLon,
      destinationLat: dto.destinationLat,
      destinationLon: dto.destinationLon,
      departureTime: dto.departureTime
        ? new Date(dto.departureTime)
        : undefined,
    };

    // L'enregistrement de l'historique (issue #11) est lance en parallele du
    // reste - il n'a besoin ni du resultat OTP ni du profil, et
    // TripHistoryService#record avale ses propres erreurs (ne peut jamais
    // faire echouer la recherche). Absent (userId undefined) : recherche non
    // authentifiee, rien a historiser (voir OptionalJwtAuthGuard).
    const [itineraries, profile] = await Promise.all([
      this.otpClient.planTrip({
        ...planParams,
        // Filtre de modes préférés (issue #87) - transmis tel quel, la
        // traduction en paramètre OTP est faite par OtpClientService.
        transportModes: dto.transportModes,
      }),
      userId ? this.profilesService.findByUserIdOrNull(userId) : null,
      userId ? this.tripHistoryService.record(userId, dto) : null,
    ]);

    const grouped = this.groupByRoute(
      itineraries.map((itinerary) => this.mapItinerary(itinerary)),
    );
    if (grouped.length > 0) {
      return { itineraries: await this.scoringService.rank(grouped, profile) };
    }

    // (#91) Aucun trajet a l'heure demandee : on cherche le prochain creneau
    // disponible en elargissant la fenetre de recherche d'OTP a 24h (un seul
    // appel, pas de boucle de sondage - voir searchWindowSeconds). L'heure de
    // depart reste la meme ; c'est OTP qui, dans cette fenetre, remonte le
    // premier depart possible au-dela de sa fenetre dynamique par defaut.
    const requestedDeparture = planParams.departureTime ?? new Date();
    const laterItineraries = await this.otpClient.planTrip({
      ...planParams,
      departureTime: requestedDeparture,
      transportModes: dto.transportModes,
      searchWindowSeconds: NEXT_SLOT_SEARCH_WINDOW_SECONDS,
    });
    const laterGrouped = this.groupByRoute(
      laterItineraries.map((itinerary) => this.mapItinerary(itinerary)),
    );
    if (laterGrouped.length > 0) {
      const ranked = await this.scoringService.rank(laterGrouped, profile);
      return {
        itineraries: ranked,
        fallback: {
          kind: 'later-departure',
          requestedDepartureTime: requestedDeparture.toISOString(),
          // Premier depart reellement propose (ranked[0] = tete de liste apres
          // scoring ; startTime = plus proche des horaires groupes, #127).
          actualDepartureTime: ranked[0].startTime,
        },
      };
    }

    // (#190) Toujours aucun trajet en transport en commun, meme plus tard :
    // repli a pied.
    const walkItineraries = await this.otpClient.planTrip({
      ...planParams,
      walkOnly: true,
    });
    const walkGrouped = this.groupByRoute(
      walkItineraries.map((itinerary) => this.mapItinerary(itinerary)),
    );
    if (walkGrouped.length === 0) {
      // Rien a pied non plus : etat vide "sec", pas de fallback (le frontend
      // affiche alors le message generique).
      return { itineraries: [] };
    }

    // Pas de scoring : un trajet a pied unique, aucun critere pondere a
    // departager (et le classement n'aurait de toute facon rien a trier).
    return { itineraries: walkGrouped, fallback: { kind: 'walk-only' } };
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
   * (itineraire alternatif, correspondance differente), et plus lisible en
   * cas de debogage qu'une suite d'identifiants GTFS bruts. route_id/trip_id
   * sont bien exposes par OTP (voir OtpLeg#routeId, issue #18, verifie
   * contre le mapper REST reel d'OTP 2.5) mais servent a un usage different
   * (TripSegment#routeId/tripId, recoupement avec les perturbations
   * GTFS-Realtime) - pas de raison de les reutiliser ici, un identifiant
   * technique ne rendrait pas cette cle plus fiable pour son propre usage.
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
      routeId: this.stripOtpFeedPrefix(leg.routeId),
      tripId: this.stripOtpFeedPrefix(leg.tripId),
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
   * Retire le prefixe "{feedId}:" qu'OTP ajoute a route_id/trip_id (voir
   * OtpLeg#routeId, issue #18) pour obtenir l'identifiant brut, celui
   * expose sans prefixe par le flux GTFS-Realtime de l'operateur (issue
   * #14, GtfsRealtimeCacheService#findDisruptions). `undefined`/vide reste
   * `undefined` (segment a pied) ; un identifiant sans ":" (jamais observe
   * en pratique, mais pas exclu par le format) est renvoye tel quel plutot
   * que de lever - un identifiant technique manque rarement d'etre exploite
   * plutot que d'echouer bruyamment.
   */
  private stripOtpFeedPrefix(id: string | undefined): string | undefined {
    if (!id) return undefined;
    const separatorIndex = id.indexOf(':');
    return separatorIndex === -1 ? id : id.slice(separatorIndex + 1);
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
