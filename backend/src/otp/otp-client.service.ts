import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpGeocodeResult } from './interfaces/otp-geocode-result.interface';
import type {
  OtpItinerary,
  OtpPlanResponse,
} from './interfaces/otp-plan-response.interface';
import { toOtpModeParam } from './otp-modes';
import type { TransportMode } from '../profiles/transport-mode.enum';

export interface PlanTripParams {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  /** Absent = "maintenant" au moment de l'appel. */
  departureTime?: Date;
  /**
   * Modes de transport préférés à privilégier (issue #87, SearchTripsDto).
   * Absent ou vide = aucun filtre (tous les transports en commun). Traduit
   * en paramètre `mode` d'OTP par toOtpModeParam.
   */
  transportModes?: TransportMode[];
  /**
   * Force une recherche `mode=WALK` seul, en ignorant `transportModes`
   * (issue #190) - utilisé par TripsService comme repli quand aucun trajet
   * en transport en commun n'a été trouvé, pour proposer un trajet à pied
   * plutôt qu'un état vide sec.
   */
  walkOnly?: boolean;
}

/**
 * Client de l'API REST d'OpenTripPlanner (issue #6) - construit la requete
 * `GET {OTP_URL}/plan` et traduit la reponse/les erreurs OTP en quelque
 * chose d'exploitable par TripsService, sans lui exposer le format brut
 * d'OTP.
 *
 * REST plutot que GraphQL (les deux sont acceptes par l'issue) : un seul
 * type de requete (planifier un trajet) ne justifie pas la complexite
 * d'un client GraphQL pour ce projet.
 */
@Injectable()
export class OtpClientService {
  private readonly logger = new Logger(OtpClientService.name);

  constructor(private readonly configService: ConfigService) {}

  async planTrip(params: PlanTripParams): Promise<OtpItinerary[]> {
    const url = this.buildPlanUrl(params);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      // OTP injoignable (service arrete, pas encore demarre, graphe encore
      // en cours de construction au demarrage...) : erreur cote
      // infrastructure, jamais renvoyee telle quelle au client (voir
      // AllExceptionsFilter).
      this.logger.error(
        `OTP injoignable (${url})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "Le moteur de calcul d'itinéraires est momentanément indisponible",
      );
    }

    if (!response.ok) {
      this.logger.error(`OTP a repondu ${response.status} (${url})`);
      throw new ServiceUnavailableException(
        "Le moteur de calcul d'itinéraires est momentanément indisponible",
      );
    }

    const body = (await response.json()) as OtpPlanResponse;

    if (body.error) {
      // id 400 : coordonnees hors de la zone couverte par le graphe charge
      // (impossible d'y rattacher un point de depart/arrivee) - la seule
      // erreur OTP traitee comme une erreur de requete cote client. Toute
      // autre valeur (404 "aucun trajet possible", 500/503 cote OTP...) est
      // traitee comme "aucun itineraire trouve" par TripsService, jamais
      // comme une erreur (voir docs/specs/f2-ecrans-planification.md,
      // section 4 : "0 resultat" est un etat vide, pas une erreur).
      if (body.error.id === 400) {
        throw new BadRequestException(
          "Origine ou destination hors de la zone couverte par le moteur de calcul d'itinéraires",
        );
      }
      return [];
    }

    return body.plan?.itineraries ?? [];
  }

  /**
   * Recherche de lieux par texte (issue #81) - delegue au geocodeur REST
   * integre a OTP (fonctionnalite sandbox, voir
   * routing-engine/otp-config.json), qui indexe les noms d'arrets/rues deja
   * charges dans le graphe. Aucun resultat n'est traite comme une liste
   * vide, jamais une erreur (meme logique que planTrip pour "aucun
   * itineraire trouve").
   */
  async geocode(query: string): Promise<OtpGeocodeResult[]> {
    const otpUrl = this.configService.get<string>('OTP_URL');
    const url = new URL(`${otpUrl}/geocode`);
    url.searchParams.set('query', query);

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(
        `OTP injoignable (${url.toString()})`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "Le moteur de calcul d'itinéraires est momentanément indisponible",
      );
    }

    if (!response.ok) {
      this.logger.error(`OTP a repondu ${response.status} (${url.toString()})`);
      throw new ServiceUnavailableException(
        "Le moteur de calcul d'itinéraires est momentanément indisponible",
      );
    }

    return (await response.json()) as OtpGeocodeResult[];
  }

  private buildPlanUrl(params: PlanTripParams): string {
    const otpUrl = this.configService.get<string>('OTP_URL');
    const timeZone = this.configService.get<string>(
      'OTP_TIMEZONE',
      'Europe/Paris',
    );
    const departure = params.departureTime ?? new Date();

    const url = new URL(`${otpUrl}/plan`);
    url.searchParams.set(
      'fromPlace',
      `${params.originLat},${params.originLon}`,
    );
    url.searchParams.set(
      'toPlace',
      `${params.destinationLat},${params.destinationLon}`,
    );
    url.searchParams.set('date', this.formatDate(departure, timeZone));
    url.searchParams.set('time', this.formatTime(departure, timeZone));
    // Repli à pied (issue #190) : `mode=WALK` seul, en ignorant tout filtre
    // de modes préférés. Sinon, modes préférés (issue #87) traduits en
    // paramètre `mode` d'OTP : `TRANSIT,WALK` par défaut (aucun filtre),
    // sinon `WALK` + les transports en commun retenus. Vélo/trottinette
    // (GBFS, F3) et covoiturage ne sont pas encore intégrés à OTP - ignorés
    // au routage même si cochés (voir otp-modes.ts).
    url.searchParams.set(
      'mode',
      params.walkOnly ? 'WALK' : toOtpModeParam(params.transportModes),
    );
    url.searchParams.set('numItineraries', '5');

    return url.toString();
  }

  /**
   * Formate une date en YYYY-MM-DD / HH:mm:ss dans le fuseau horaire donne
   * (`timeZone`), quel que soit le fuseau du serveur qui execute ce code -
   * important car le conteneur backend tourne en UTC par defaut, alors
   * qu'OTP interprete date/heure dans le fuseau de l'agence GTFS chargee
   * (`agency_timezone`, "Europe/Paris" pour notre jeu de test).
   */
  private formatDate(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  }

  private formatTime(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  }
}
