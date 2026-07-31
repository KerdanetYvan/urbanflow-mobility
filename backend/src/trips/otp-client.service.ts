import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  OtpItinerary,
  OtpPlanResponse,
} from './interfaces/otp-plan-response.interface';

export interface PlanTripParams {
  originLat: number;
  originLon: number;
  destinationLat: number;
  destinationLon: number;
  /** Absent = "maintenant" au moment de l'appel. */
  departureTime?: Date;
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
    // TRANSIT+WALK : les seuls modes que notre jeu de donnees de test
    // (routing-engine/test-fixtures/) sait vraiment planifier (voir son
    // README) - velo/trottinette (GBFS, F3) et covoiturage ne sont pas
    // encore integres a OTP, a ajouter avec leurs issues dediees.
    url.searchParams.set('mode', 'TRANSIT,WALK');
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
