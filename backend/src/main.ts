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

  // Filtre d'exceptions global : toute erreur levee dans un controleur/service
  // (volontaire ou non) passe par ce filtre pour etre formatee et loggee de
  // maniere homogene (voir common/filters/all-exceptions.filter.ts).
  app.useGlobalFilters(new AllExceptionsFilter());

  // Intercepteur global : logge chaque requete HTTP entrante (methode, route,
  // code retour, duree), independamment du fait qu'elle reussisse ou echoue.
  app.useGlobalInterceptors(new LoggingInterceptor());

  // PORT vient de l'environnement (utile pour un hebergement type Scaleway/OVHcloud
  // qui impose son propre port) ; 3000 par defaut en developpement local.
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
