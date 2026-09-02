import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { MobilityOperatorConfig } from './interfaces/mobility-operator-config.interface';

/**
 * Operateur par defaut (issue #15) : le flux reel "le velo STAR" +
 * GTFS-Realtime de Rennes Metropole, deja verifies en session (issues
 * #13/#14). Memes URLs que les anciennes constantes DEFAULT_GBFS_DISCOVERY_URL
 * (gbfs-cache.service.ts) / DEFAULT_TRIP_UPDATES_URL/DEFAULT_ALERTS_URL
 * (gtfs-realtime-cache.service.ts), desormais centralisees ici - source
 * unique pour "le comportement zero-configuration" attendu en dev, sans
 * jamais renseigner MOBILITY_OPERATORS.
 */
const DEFAULT_OPERATORS: MobilityOperatorConfig[] = [
  {
    id: 'star-rennes',
    name: 'STAR (Rennes Métropole)',
    gbfsDiscoveryUrl: 'https://eu.ftp.opendatasoft.com/star/gbfs/gbfs.json',
    gtfsRealtimeTripUpdatesUrl:
      'https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-trip-update',
    gtfsRealtimeAlertsUrl:
      'https://proxy.transport.data.gouv.fr/resource/star-rennes-integration-gtfs-rt-alerts',
  },
];

/**
 * Verifie qu'une valeur decodee du JSON de MOBILITY_OPERATORS ressemble a un
 * MobilityOperatorConfig valide - validation volontairement minimale (id/name
 * non vides, urls optionnelles mais des chaines si presentes) : ce service
 * n'a pas a se comporter comme une passerelle de validation complete
 * (class-validator, reserve aux DTO HTTP), juste a ne pas planter tout le
 * cache GBFS/GTFS-Realtime pour une faute de frappe dans un champ optionnel.
 */
function isValidOperatorConfig(
  value: unknown,
): value is MobilityOperatorConfig {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  const isOptionalString = (field: unknown) =>
    field === undefined || typeof field === 'string';
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.name === 'string' &&
    candidate.name.length > 0 &&
    isOptionalString(candidate.gbfsDiscoveryUrl) &&
    isOptionalString(candidate.gtfsRealtimeTripUpdatesUrl) &&
    isOptionalString(candidate.gtfsRealtimeAlertsUrl)
  );
}

/**
 * Source unique des operateurs de mobilite configures (issue #15,
 * "Configuration des operateurs externalisee - pas de code en dur") -
 * consommee par GbfsCacheService (#13) et GtfsRealtimeCacheService (#14)
 * pour savoir QUELS flux interroger, sans jamais coder en dur un operateur
 * particulier dans ces deux services (voir MobilityOperatorConfig).
 *
 * Ajouter un operateur = ajouter une entree au tableau JSON de
 * MOBILITY_OPERATORS (.env), jamais modifier ce fichier ni les caches qui le
 * consomment - critere d'acceptation de #15.
 */
@Injectable()
export class OperatorsService {
  private readonly logger = new Logger(OperatorsService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Tous les operateurs configures. `MOBILITY_OPERATORS` absente ou
   * illisible (JSON invalide, aucune entree valide) -> repli sur
   * DEFAULT_OPERATORS (l'operateur reel de la metropole) plutot qu'une
   * liste vide, qui viderait silencieusement toute la carte/detection de
   * perturbations - meme esprit de degradation que GbfsClientService (jamais
   * d'exception qui romprait le demarrage de l'app pour une variable
   * d'environnement mal formee).
   */
  getOperators(): MobilityOperatorConfig[] {
    const raw = this.configService.get<string>('MOBILITY_OPERATORS');
    if (!raw) return DEFAULT_OPERATORS;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      this.logger.warn(
        `MOBILITY_OPERATORS n'est pas un JSON valide - repli sur l'operateur par defaut : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return DEFAULT_OPERATORS;
    }

    if (!Array.isArray(parsed)) {
      this.logger.warn(
        "MOBILITY_OPERATORS doit etre un tableau JSON - repli sur l'operateur par defaut",
      );
      return DEFAULT_OPERATORS;
    }

    const operators = parsed.filter(isValidOperatorConfig);
    if (operators.length === 0) {
      this.logger.warn(
        "MOBILITY_OPERATORS ne contient aucun operateur valide (id/name requis) - repli sur l'operateur par defaut",
      );
      return DEFAULT_OPERATORS;
    }
    if (operators.length !== parsed.length) {
      this.logger.warn(
        `${parsed.length - operators.length} entree(s) de MOBILITY_OPERATORS ignoree(s) (id/name manquant ou invalide)`,
      );
    }

    return operators;
  }
}
