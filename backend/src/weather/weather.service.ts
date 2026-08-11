import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OpenMeteoResponse } from './interfaces/open-meteo-response.interface';

export interface CurrentWeather {
  /** Precipitations en cours, en mm - voir OpenMeteoCurrentConditions#precipitation. */
  precipitationMm: number;
}

/**
 * Point de reference unique pour toute la metropole (centre-ville de
 * Rennes) - jamais l'origine/destination de la recherche ni la position de
 * l'usager. Coherent avec la mitigation RGPD du dossier (partie 10.2,
 * tableau des risques) : un appel a un service tiers ne doit transmettre
 * qu'une zone generale, jamais une position precise liee a un usager.
 */
const METROPOLE_REFERENCE_POINT = { lat: 48.1173, lon: -1.6778 };

/** Cache en memoire, pas de Redis dans la stack pour une seule valeur (voir le plan de l'issue #17). */
const CACHE_TTL_MS = 30 * 60 * 1000;

/**
 * Critere meteo du service de scoring (issue #17, partie 7.3 du dossier -
 * "Score <--> Meteo" sur le diagramme de communication 8.3 : c'est le
 * service de scoring qui interroge la meteo, pas TripsService). Open-Meteo
 * (api.open-meteo.com) retenu plutot qu'un fournisseur a cle API : aucun
 * secret a provisionner/deployer, hebergement UE, gratuit en usage
 * non-commercial.
 */
@Injectable()
export class WeatherService {
  private readonly logger = new Logger(WeatherService.name);

  private cached: { weather: CurrentWeather; fetchedAt: number } | null = null;
  /** Memoise une requete en cours : evite un appel HTTP par recherche simultanee (eco-conception). */
  private pending: Promise<CurrentWeather | null> | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Conditions meteo actuelles pour la metropole, avec cache (CACHE_TTL_MS).
   * Ne leve jamais d'exception - la meteo est un critere d'enrichissement du
   * scoring, jamais bloquant pour GET /trips : toute erreur (reseau,
   * timeout, reponse invalide) est loggee et renvoie null, auquel cas
   * ScoringService n'applique simplement aucun malus pluie.
   */
  async getCurrentConditions(): Promise<CurrentWeather | null> {
    if (this.cached && Date.now() - this.cached.fetchedAt < CACHE_TTL_MS) {
      return this.cached.weather;
    }

    if (this.pending) {
      return this.pending;
    }

    this.pending = this.fetchCurrentConditions();
    try {
      return await this.pending;
    } finally {
      this.pending = null;
    }
  }

  private async fetchCurrentConditions(): Promise<CurrentWeather | null> {
    const url = this.buildForecastUrl();

    let response: Response;
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    } catch (error) {
      this.logger.warn(
        `API meteo injoignable (${url}) - scoring sans critere meteo`,
        error instanceof Error ? error.stack : undefined,
      );
      return null;
    }

    if (!response.ok) {
      this.logger.warn(`API meteo a repondu ${response.status} (${url})`);
      return null;
    }

    const body = (await response.json()) as OpenMeteoResponse;
    if (!body.current) {
      this.logger.warn(`Reponse meteo sans champ "current" (${url})`);
      return null;
    }

    const weather: CurrentWeather = {
      precipitationMm: body.current.precipitation,
    };
    this.cached = { weather, fetchedAt: Date.now() };
    return weather;
  }

  private buildForecastUrl(): string {
    // "|| defaut" plutot que le 2e argument de ConfigService#get : .env
    // peut definir WEATHER_API_URL a vide (scaffold historique de #17, voir
    // .env.example) - ConfigService ne retombe sur le defaut que si la cle
    // est absente, pas si elle vaut "".
    const baseUrl =
      this.configService.get<string>('WEATHER_API_URL') ||
      'https://api.open-meteo.com/v1/forecast';
    const url = new URL(baseUrl);
    url.searchParams.set('latitude', String(METROPOLE_REFERENCE_POINT.lat));
    url.searchParams.set('longitude', String(METROPOLE_REFERENCE_POINT.lon));
    url.searchParams.set('current', 'precipitation,rain');
    return url.toString();
  }
}
