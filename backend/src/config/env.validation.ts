import { plainToInstance } from 'class-transformer';
import { IsNotEmpty, IsString, validateSync } from 'class-validator';
import { decodeEncryptionKey } from '../common/encryption/encrypted-column.transformer';

/**
 * Validation des variables d'environnement au demarrage de l'application
 * (branchee via `validate` dans ConfigModule.forRoot, voir AppModule).
 *
 * Motivation (issue #281) : GEOLOCATION_ENCRYPTION_KEY etait absente du `.env`
 * de production. Rien ne le signalait au boot - le backend demarrait
 * normalement, puis CHAQUE ecriture chiffree echouait silencieusement
 * (TripHistoryService#record avale ses erreurs par conception), et
 * l'historique restait vide sans le moindre message. Un secret critique
 * manquant doit faire ECHOUER le demarrage, pas degrader en perte de donnees
 * silencieuse : le conteneur qui ne demarre pas est immediatement visible en
 * deploiement, une table qui ne se remplit jamais ne l'est pas.
 *
 * Perimetre volontairement restreint aux secrets sans lesquels l'app est soit
 * inutilisable, soit silencieusement cassee : connexion base, secrets JWT,
 * cle de chiffrement au repos. Les variables des fonctionnalites a mode
 * degrade assume (VAPID/notifications - issue #277, SMTP, meteo, operateurs)
 * restent optionnelles et ne sont pas verifiees ici.
 *
 * Approche class-validator (et non Joi) : class-validator/class-transformer
 * sont deja des dependances (validation des DTO), pas de package en plus.
 */
class RequiredEnvironmentVariables {
  /** Chaine de connexion PostgreSQL - sans elle, aucune requete ne peut aboutir. */
  @IsString()
  @IsNotEmpty()
  DATABASE_URL!: string;

  /** Secret de signature des access tokens JWT - absent => tokens signes avec `undefined`, trou de securite silencieux. */
  @IsString()
  @IsNotEmpty()
  JWT_SECRET!: string;

  /** Secret de signature des refresh tokens JWT - meme risque que JWT_SECRET. */
  @IsString()
  @IsNotEmpty()
  JWT_REFRESH_SECRET!: string;

  /**
   * Cle de chiffrement au repos des donnees de geolocalisation (RGPD, issue
   * #22). La contrainte fine (base64 -> 32 octets exactement) est verifiee a
   * part par decodeEncryptionKey ci-dessous, class-validator ne garantit ici
   * que "presente et non vide".
   */
  @IsString()
  @IsNotEmpty()
  GEOLOCATION_ENCRYPTION_KEY!: string;
}

/**
 * Valide l'objet de configuration assemble par @nestjs/config (variables du
 * `.env` + process.env). Levee une erreur agregeant tous les manques => le
 * demarrage de NestJS est interrompu avec un message lisible.
 *
 * @param config l'ensemble des variables d'environnement vues par l'app
 * @returns le meme objet de configuration (les cles non listees ici sont
 *   conservees telles quelles - plainToInstance ne retire pas les proprietes
 *   supplementaires), pour que ConfigService continue de tout exposer
 * @throws Error listant chaque variable requise absente ou invalide
 */
export function validateEnv(
  config: Record<string, unknown>,
): Record<string, unknown> {
  // `plainToInstance` conserve toutes les proprietes de `config` (pas de
  // whitelist) et se contente d'exposer celles qu'on a decorees pour la
  // validation - on ne perd donc aucune autre variable d'environnement.
  const validated = plainToInstance(RequiredEnvironmentVariables, config, {
    enableImplicitConversion: false,
  });

  // skipMissingProperties: false => une variable totalement absente est
  // signalee au meme titre qu'une variable presente mais invalide.
  const errors = validateSync(validated, { skipMissingProperties: false });

  const problems = errors.map((error) => {
    const reasons = Object.values(error.constraints ?? {}).join(', ');
    return ` - ${error.property} : ${reasons || 'valeur invalide'}`;
  });

  // Verification dediee de la cle de chiffrement : meme regle exacte que le
  // transformer a l'execution (base64 decode en 32 octets), pour qu'une cle
  // presente mais mal dimensionnee soit rejetee au boot et pas seulement a la
  // premiere ecriture chiffree. Ignoree si la valeur est absente ou vide -
  // class-validator (@IsNotEmpty) l'a deja signalee, pas la peine de la
  // reporter deux fois.
  if (
    typeof config.GEOLOCATION_ENCRYPTION_KEY === 'string' &&
    config.GEOLOCATION_ENCRYPTION_KEY.length > 0
  ) {
    try {
      decodeEncryptionKey(config.GEOLOCATION_ENCRYPTION_KEY);
    } catch (error) {
      problems.push(
        ` - GEOLOCATION_ENCRYPTION_KEY : ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if (problems.length > 0) {
    throw new Error(
      "Configuration d'environnement invalide - le demarrage est interrompu " +
        '(voir .env.example) :\n' +
        problems.join('\n'),
    );
  }

  return config;
}
