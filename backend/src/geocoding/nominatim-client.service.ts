import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  NominatimAddress,
  NominatimResult,
} from './interfaces/nominatim-result.interface';

/** Un lieu géocodé par Nominatim, déjà mis en forme (libellé court, lat/lon numériques). */
export interface GeocodedAddress {
  label: string;
  lat: number;
  lon: number;
}

/**
 * Bornes de Rennes Métropole (bbox lon/lat, cf. `routing-engine/README.md`).
 * Passées à Nominatim en `viewbox` + `bounded=1` : les résultats sont
 * restreints à la métropole - l'usager cherche dans sa métropole, ce
 * contexte est implicite (docs/specs/nominatim-geocodage-adresses.md §4.2).
 */
const METROPOLE_VIEWBOX = '-1.95,47.97,-1.48,48.30';

/** Plafond de résultats demandés à Nominatim (la fusion côté PlacesService en garde 5). */
const NOMINATIM_LIMIT = 8;

/**
 * Client du Nominatim auto-hébergé (issue #167/#168) - géocodage d'adresses
 * postales réelles, en complément du géocodeur d'OTP qui ne connaît que les
 * arrêts (voir docs/specs/nominatim-geocodage-adresses.md).
 *
 * Symétrique d'`OtpClientService#geocode`. Différence de contrat volontaire :
 * une indisponibilité de Nominatim renvoie une **liste vide** (loggée), pas
 * une exception - l'autocomplétion doit continuer à fonctionner avec les
 * seuls arrêts si le service adresses est en panne (spec §5).
 */
@Injectable()
export class NominatimClientService {
  private readonly logger = new Logger(NominatimClientService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Recherche d'adresses par texte libre. Renvoie au plus NOMINATIM_LIMIT
   * lieux de la métropole, libellés déjà mis en forme (`{numéro} {voie},
   * {commune}`). Jamais d'exception : `[]` si Nominatim est injoignable ou
   * répond mal.
   */
  async search(query: string): Promise<GeocodedAddress[]> {
    const baseUrl = this.configService.get<string>('NOMINATIM_URL');
    if (!baseUrl) {
      this.logger.warn(
        'NOMINATIM_URL non configurée - géocodage adresses désactivé',
      );
      return [];
    }

    const url = new URL(`${baseUrl}/search`);
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(NOMINATIM_LIMIT));
    url.searchParams.set('countrycodes', 'fr');
    url.searchParams.set('accept-language', 'fr');
    url.searchParams.set('viewbox', METROPOLE_VIEWBOX);
    url.searchParams.set('bounded', '1');

    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.warn(
        `Nominatim injoignable (${url.toString()}) - résultats adresses ignorés : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }

    if (!response.ok) {
      this.logger.warn(
        `Nominatim a répondu ${response.status} (${url.toString()}) - résultats adresses ignorés`,
      );
      return [];
    }

    let results: NominatimResult[];
    try {
      results = (await response.json()) as NominatimResult[];
    } catch {
      this.logger.warn(
        'Réponse Nominatim illisible - résultats adresses ignorés',
      );
      return [];
    }

    return results
      .map((result) => this.toGeocodedAddress(result))
      .filter((place): place is GeocodedAddress => place !== null);
  }

  /**
   * Reconstruit un libellé court (`12 Rue de Nemours, Rennes`) à partir des
   * champs structurés de Nominatim, plutôt que le `display_name` verbeux.
   * Renvoie `null` si le résultat n'a ni coordonnées exploitables ni libellé.
   */
  private toGeocodedAddress(result: NominatimResult): GeocodedAddress | null {
    const lat = Number(result.lat);
    const lon = Number(result.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    const label = this.buildLabel(result.address, result.display_name);
    if (!label) {
      return null;
    }

    return { label, lat, lon };
  }

  private buildLabel(
    address: NominatimAddress | undefined,
    displayName: string,
  ): string {
    const road =
      address?.road ?? address?.pedestrian ?? address?.footway ?? undefined;
    const city =
      address?.city ??
      address?.town ??
      address?.village ??
      address?.municipality ??
      address?.county ??
      undefined;

    const parts: string[] = [];
    if (road) {
      parts.push(
        address?.house_number ? `${address.house_number} ${road}` : road,
      );
    }
    if (city && city !== road) {
      parts.push(city);
    }

    if (parts.length > 0) {
      return parts.join(', ');
    }

    // Repli (résultat sans voie ni commune identifiables, ex. un POI isolé) :
    // le premier segment du display_name, souvent le nom propre du lieu.
    return displayName.split(',')[0]?.trim() ?? '';
  }
}
