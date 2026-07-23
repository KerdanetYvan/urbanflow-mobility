import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Intercepteur global qui logge chaque requete HTTP traitee par l'API.
 *
 * Contrairement au AllExceptionsFilter (qui ne se declenche qu'en cas d'erreur),
 * cet intercepteur s'execute pour TOUTE requete, succes comme echec, et permet
 * de savoir en continu ce qui transite sur l'API (methode, route, code retour, duree).
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  // Logger avec le contexte "HTTP" : les logs affichent "[HTTP]" pour bien
  // les distinguer des logs applicatifs (services, filtres, etc.)
  private readonly logger = new Logger('HTTP');

  /**
   * Methode appelee par NestJS autour de chaque requete.
   *
   * `next.handle()` represente la suite du traitement (controleur, service...).
   * On mesure le temps ecoule avant/apres cet appel, puis on logge une fois
   * la reponse prete, via l'operateur RxJS `tap` (qui n'altere pas la reponse,
   * il se contente d'observer son passage).
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // ExecutionContext est generique (HTTP, WebSocket, RPC...) : on recupere
    // ici explicitement la requete/reponse HTTP (Express) sous-jacentes.
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, url } = request;
    // Horodatage de depart pour calculer la duree totale de traitement
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        // A ce stade, la reponse a ete envoyee : response.statusCode est final
        const duration = Date.now() - start;
        this.logger.log(
          `${method} ${url} ${response.statusCode} +${duration}ms`,
        );
      }),
    );
  }
}
