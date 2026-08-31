import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { NominatimClientService } from '../geocoding/nominatim-client.service';
import { OtpClientService } from '../otp/otp-client.service';
import { SearchPlacesDto } from './dto/search-places.dto';
import type { PlaceSuggestion } from './dto/place-suggestion.dto';

/** Nombre max d'arrets / d'adresses conserves dans la liste fusionnee (spec #167 §2.1). */
const MAX_STOPS = 5;
const MAX_ADDRESSES = 5;

/**
 * Retire le code d'arret entre parentheses ajoute par le geocodeur OTP
 * ("République (1615)" -> "République") - sert aussi de cle de deduplication
 * des poteaux d'un meme arret (spec #167 §4.1).
 */
function cleanStopLabel(description: string): string {
  return description.replace(/\s*\(\d+\)\s*$/, '').trim();
}

@Injectable()
export class PlacesService {
  constructor(
    private readonly otpClient: OtpClientService,
    private readonly nominatimClient: NominatimClientService,
  ) {}

  /**
   * Recherche de lieux par texte (issue #81, enrichie #167/#168) pour
   * l'autocompletion origine/destination. Interroge en parallele :
   * - le geocodeur OTP (arrets de transport, avec leurs coordonnees de
   *   routage) ;
   * - Nominatim (adresses postales reelles).
   *
   * Fusionne : arrets d'abord (dedupliques, code entre parentheses retire),
   * puis adresses ; 5 de chaque au maximum. L'indisponibilite d'UNE source
   * ne casse pas l'autocomplétion (resultats partiels en 200) ; 503
   * uniquement si les deux sources sont injoignables (spec §5).
   */
  async search(dto: SearchPlacesDto): Promise<PlaceSuggestion[]> {
    const [stopsOutcome, addressesOutcome] = await Promise.allSettled([
      this.otpClient.geocode(dto.query),
      this.nominatimClient.search(dto.query),
    ]);

    if (
      stopsOutcome.status === 'rejected' &&
      addressesOutcome.status === 'rejected'
    ) {
      // Les deux sources sont tombees : on conserve le comportement
      // historique (503). On relaie l'exception d'OTP si c'en est une, sinon
      // une 503 generique.
      throw stopsOutcome.reason instanceof Error
        ? stopsOutcome.reason
        : new ServiceUnavailableException(
            'Le service de recherche de lieux est momentanément indisponible',
          );
    }

    const stops: PlaceSuggestion[] =
      stopsOutcome.status === 'fulfilled'
        ? this.dedupeStops(stopsOutcome.value)
            .slice(0, MAX_STOPS)
            .map((result) => ({
              label: cleanStopLabel(result.description),
              lat: result.lat,
              lon: result.lng,
              kind: 'stop' as const,
            }))
        : [];

    const addresses: PlaceSuggestion[] =
      addressesOutcome.status === 'fulfilled'
        ? this.dedupeByLabel(addressesOutcome.value)
            .slice(0, MAX_ADDRESSES)
            .map((place) => ({
              label: place.label,
              lat: place.lat,
              lon: place.lon,
              kind: 'address' as const,
            }))
        : [];

    return [...stops, ...addresses];
  }

  /**
   * Deduplique les resultats OTP par nom d'arret (code entre parentheses
   * ignore) : les N poteaux "République (1615/1242/…)" deviennent une seule
   * entree, celle du premier resultat OTP (le routage rattachera de toute
   * facon a l'arret le plus proche).
   */
  private dedupeStops<T extends { description: string }>(results: T[]): T[] {
    const seen = new Set<string>();
    return results.filter((result) => {
      const name = cleanStopLabel(result.description);
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
  }

  /**
   * Deduplique par libelle (garde la 1re occurrence) - Nominatim peut
   * renvoyer plusieurs troncons OSM d'une meme voie ("Rue Aurelie Nemours,
   * Rennes" x2 dans deux quartiers), inutile de les montrer tous.
   */
  private dedupeByLabel<T extends { label: string }>(places: T[]): T[] {
    const seen = new Set<string>();
    return places.filter((place) => {
      if (seen.has(place.label)) {
        return false;
      }
      seen.add(place.label);
      return true;
    });
  }
}
