import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

/**
 * Point d'entree de l'application NestJS.
 * Cree l'instance de l'app a partir du module racine (AppModule), branche les
 * mecanismes globaux communs a toute l'API, puis demarre le serveur HTTP.
 */
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS : le frontend (port 5173 en dev) et le backend (port 3000) sont
  // deux origines differentes du point de vue du navigateur. Sans ceci,
  // toutes les requetes fetch() du frontend vers l'API seraient bloquees.
  // Origine configurable par environnement plutot qu'un "origin: true"
  // qui accepterait n'importe quel site (OWASP - eviter d'ouvrir l'API a
  // des origines non prevues, notamment une fois deployee).
  const configService = app.get(ConfigService);
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:5173'),
  });

  // Filtre d'exceptions global : toute erreur levee dans un controleur/service
  // (volontaire ou non) passe par ce filtre pour etre formatee et loggee de
  // maniere homogene (voir common/filters/all-exceptions.filter.ts).
  app.useGlobalFilters(new AllExceptionsFilter());

  // Intercepteur global : logge chaque requete HTTP entrante (methode, route,
  // code retour, duree), independamment du fait qu'elle reussisse ou echoue.
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Validation globale des DTO (class-validator) sur toutes les routes :
  // - whitelist : retire silencieusement les champs non declares dans le DTO
  // - forbidNonWhitelisted : rejette la requete (400) si des champs en trop
  //   sont envoyes, plutot que de les ignorer silencieusement (OWASP -
  //   surface d'attaque reduite, pas de champ cache qui passerait sans le
  //   vouloir)
  // - transform : convertit le payload JSON brut en instance de la classe
  //   DTO (necessaire pour que les decorateurs class-validator s'appliquent)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // PORT vient de l'environnement (utile pour un hebergement type Scaleway/OVHcloud
  // qui impose son propre port) ; 3000 par defaut en developpement local.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
