import { Injectable, Logger } from '@nestjs/common';
import type { SharedMobilityStation } from './dto/shared-mobility-station.dto';

/** Un feed nomme dans le fichier d'auto-decouverte gbfs.json (ex. "station_information"). */
interface GbfsFeed {
  name: string;
  url: string;
}

/**
 * Fichier racine d'auto-decouverte GBFS (gbfs.json). Deux formes coexistent
 * selon la version du standard suivie par l'operateur :
 * - v1.x/v2.x : `data.<langue>.feeds[]` (ex. `data.fr.feeds`, celle utilisee
 *   par le flux reel STAR Rennes verifie en session) ;
 * - v3.x : `data.feeds[]` directement, sans indirection par langue.
 * `extractFeeds` ci-dessous accepte les deux sans distinguer l'operateur.
 */
interface GbfsDiscoveryResponse {
  data: {
    feeds?: GbfsFeed[];
    [language: string]: { feeds: GbfsFeed[] } | GbfsFeed[] | undefined;
  };
}

interface GbfsStationInformationRow {
  station_id: string;
  name?: string;
  lat: number;
  lon: number;
  capacity?: number;
}

interface GbfsStationStatusRow {
  station_id: string;
  num_bikes_available: number;
  num_docks_available?: number;
  // Standard GBFS : booleen strict en v2.3+, mais encore expose en 0/1
  // (entier) par plusieurs operateurs dont STAR Rennes (verifie en session,
  // gbfs.json v1) - on accepte les deux pour rester tolerant a la variante
  // reellement rencontree plutot qu'a la seule lettre du standard.
  is_renting?: boolean | number;
}

interface GbfsFreeBikeStatusRow {
  bike_id: string;
  lat: number;
  lon: number;
  is_reserved?: boolean | number;
  is_disabled?: boolean | number;
}

/**
 * Connecteur GBFS generique (issue #13, F3) : etant donne l'URL du fichier
 * d'auto-decouverte d'un operateur (gbfs.json), recupere et fusionne ses
 * flux de disponibilite dans la forme unifiee SharedMobilityStation - station
 * a quai fixe (station_information + station_status) ou vehicule
 * free-floating (free_bike_status), selon ce que l'operateur expose.
 *
 * "Generique" au sens de l'exigence d'interoperabilite (CLAUDE.md) : ne
 * suppose rien de specifique a un operateur, uniquement le standard GBFS
 * (https://gbfs.org) - un nouvel operateur s'integre par simple ajout d'une
 * entree a MOBILITY_OPERATORS (issue #15, voir OperatorsService), sans
 * modification de ce service.
 *
 * Degradation (meme contrat que NominatimClientService, voir
 * geocoding/nominatim-client.service.ts) : jamais d'exception, une source
 * injoignable/illisible renvoie simplement un tableau vide (logge en warn) -
 * l'absence de stations sur la carte ne doit jamais faire echouer l'ecran de
 * recherche.
 */
@Injectable()
export class GbfsClientService {
  private readonly logger = new Logger(GbfsClientService.name);

  /**
   * Point d'entree : gbfs.json -> feeds pertinents -> stations unifiees.
   * `operatorId` (MobilityOperatorConfig#id, issue #15) est repris tel quel
   * sur chaque station renvoyee - permet a l'appelant (GbfsCacheService) de
   * fusionner les resultats de plusieurs operateurs sans perdre leur origine
   * ni risquer une collision d'id entre deux operateurs distincts.
   * `[]` (logge) si le flux est injoignable, mal forme, ou ne publie ni
   * station_information ni free_bike_status (aucun feed exploitable).
   */
  async fetchStations(
    discoveryUrl: string,
    operatorId: string,
  ): Promise<SharedMobilityStation[]> {
    const discovery = await this.fetchJson<GbfsDiscoveryResponse>(discoveryUrl);
    if (!discovery) return [];

    const feeds = this.extractFeeds(discovery);
    const stationInformationUrl = feeds.get('station_information');
    const freeBikeStatusUrl = feeds.get('free_bike_status');

    if (stationInformationUrl) {
      return this.fetchStationBased(
        stationInformationUrl,
        feeds.get('station_status'),
        operatorId,
      );
    }

    if (freeBikeStatusUrl) {
      return this.fetchFreeFloating(freeBikeStatusUrl, operatorId);
    }

    this.logger.warn(
      `Aucun feed station_information/free_bike_status expose par ${discoveryUrl} - aucune station chargee`,
    );
    return [];
  }

  /**
   * Aplati `data.feeds` (v3) ou `data.<langue>.feeds` (v1/v2) en une map
   * nom de feed -> URL. Prend le francais s'il est propose, sinon la
   * premiere langue listee - le contenu des feeds GBFS (coordonnees,
   * compteurs) n'est de toute facon pas localise, seul le nom de la station
   * pourrait l'etre.
   */
  private extractFeeds(discovery: GbfsDiscoveryResponse): Map<string, string> {
    const map = new Map<string, string>();
    const data = discovery.data;

    const feedsList: GbfsFeed[] | undefined = Array.isArray(data.feeds)
      ? data.feeds
      : ((data.fr as { feeds: GbfsFeed[] } | undefined)?.feeds ??
        Object.values(data).find(
          (value): value is { feeds: GbfsFeed[] } =>
            typeof value === 'object' &&
            value !== null &&
            !Array.isArray(value) &&
            Array.isArray((value as { feeds?: unknown }).feeds),
        )?.feeds);

    for (const feed of feedsList ?? []) {
      map.set(feed.name, feed.url);
    }
    return map;
  }

  /**
   * Stations a quai fixe : fusionne les donnees statiques (nom, position,
   * capacite) de station_information avec les compteurs dynamiques de
   * station_status, par station_id. Une station sans entree status
   * correspondante (flux status en panne ou pas encore synchronise) est tout
   * de meme renvoyee, comme fermee a la location plutot que masquee (voir
   * SharedMobilityStation#isRenting) - preferable a la faire disparaitre de
   * la carte.
   */
  private async fetchStationBased(
    informationUrl: string,
    statusUrl: string | undefined,
    operatorId: string,
  ): Promise<SharedMobilityStation[]> {
    const [information, status] = await Promise.all([
      this.fetchJson<{ data: { stations: GbfsStationInformationRow[] } }>(
        informationUrl,
      ),
      statusUrl
        ? this.fetchJson<{ data: { stations: GbfsStationStatusRow[] } }>(
            statusUrl,
          )
        : Promise.resolve(null),
    ]);

    if (!information) return [];

    const statusById = new Map(
      (status?.data.stations ?? []).map((row) => [row.station_id, row]),
    );

    return information.data.stations
      .filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon))
      .map((row) => {
        const rowStatus = statusById.get(row.station_id);
        const bikesAvailable = rowStatus?.num_bikes_available ?? 0;
        const docksAvailable =
          rowStatus?.num_docks_available ??
          (row.capacity !== undefined
            ? Math.max(row.capacity - bikesAvailable, 0)
            : undefined);

        return {
          id: row.station_id,
          operatorId,
          name: row.name,
          lat: row.lat,
          lon: row.lon,
          kind: 'station' as const,
          bikesAvailable,
          docksAvailable,
          // Absence de status = on ne peut pas garantir que la station loue
          // encore - traitee comme fermee plutot que comme ouverte par
          // defaut (defaut cote securite de l'information affichee).
          isRenting: this.toBoolean(rowStatus?.is_renting) ?? false,
        };
      });
  }

  /**
   * Vehicules free-floating (trottinettes/velos sans station) : chaque ligne
   * de free_bike_status devient une entree isolee (1 vehicule = 1
   * disponibilite). Les vehicules reserves ou desactives sont exclus - ils
   * ne sont pas reellement disponibles a la location, les afficher
   * induirait l'usager en erreur.
   */
  private async fetchFreeFloating(
    freeBikeStatusUrl: string,
    operatorId: string,
  ): Promise<SharedMobilityStation[]> {
    const feed = await this.fetchJson<{
      data: { bikes: GbfsFreeBikeStatusRow[] };
    }>(freeBikeStatusUrl);
    if (!feed) return [];

    return feed.data.bikes
      .filter(
        (row) =>
          Number.isFinite(row.lat) &&
          Number.isFinite(row.lon) &&
          !this.toBoolean(row.is_reserved) &&
          !this.toBoolean(row.is_disabled),
      )
      .map((row) => ({
        id: row.bike_id,
        operatorId,
        lat: row.lat,
        lon: row.lon,
        kind: 'vehicle' as const,
        bikesAvailable: 1,
        isRenting: true,
      }));
  }

  /** GBFS expose des booleens tantot en `true`/`false`, tantot en `1`/`0` (legacy) - normalise les deux. */
  private toBoolean(value: boolean | number | undefined): boolean | undefined {
    if (value === undefined) return undefined;
    return typeof value === 'number' ? value !== 0 : value;
  }

  /** GET JSON generique, jamais d'exception - `null` (logge) sur toute erreur reseau/HTTP/parsing. */
  private async fetchJson<T>(url: string): Promise<T | null> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.warn(
        `Flux GBFS injoignable (${url}) : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }

    if (!response.ok) {
      this.logger.warn(`Flux GBFS a repondu ${response.status} (${url})`);
      return null;
    }

    try {
      return (await response.json()) as T;
    } catch {
      this.logger.warn(`Reponse GBFS illisible (${url})`);
      return null;
    }
  }
}
