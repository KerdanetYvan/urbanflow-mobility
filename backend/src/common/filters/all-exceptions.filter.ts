import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Forme normalisee de toute reponse d'erreur renvoyee par l'API.
 * Utilisee pour que le frontend puisse traiter une erreur de la meme
 * facon quel que soit l'endpoint ou le type d'exception d'origine.
 */
interface ErrorResponseBody {
  // Code HTTP (400, 401, 404, 500, ...)
  statusCode: number;
  // Date/heure de l'erreur au format ISO 8601, utile pour recouper avec les logs serveur
  timestamp: string;
  // Route appelee au moment de l'erreur (ex. "/trips")
  path: string;
  // Message(s) d'erreur a afficher : une chaine simple, ou un tableau
  // (cas des erreurs de validation avec plusieurs champs en erreur)
  message: string | string[];
}

/**
 * Filtre d'exceptions global de l'API.
 *
 * Intercepte absolument toutes les exceptions non gerees (`@Catch()` sans
 * argument = tous les types), qu'elles viennent d'un `throw new BadRequestException(...)`
 * volontaire ou d'un bug non prevu (erreur TypeORM, exception JavaScript classique, etc.).
 *
 * Deux objectifs :
 * 1. Renvoyer au client une reponse d'erreur toujours au meme format (`ErrorResponseBody`).
 * 2. Ne jamais exposer au client le detail d'une erreur non controlee (elle peut contenir
 *    des informations sensibles : requete SQL, chemin de fichier interne, etc.) tout en
 *    loggant ce detail cote serveur pour pouvoir deboguer.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  // Logger nomme d'apres la classe : les logs affichent "[AllExceptionsFilter]" comme contexte
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    // ArgumentsHost est generique (HTTP, WebSocket, RPC...) : on bascule
    // explicitement sur le contexte HTTP pour recuperer request/response Express.
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Les exceptions levees volontairement dans le code (BadRequestException,
    // UnauthorizedException, NotFoundException, ...) heritent toutes de HttpException
    // et savent quel code HTTP renvoyer. Tout le reste (erreur non prevue) devient un 500.
    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // Construit le message a renvoyer au client (jamais le detail brut d'une erreur non controlee)
    const message = this.resolveMessage(exception, isHttpException);

    const body: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    // Prefixe commun a toutes les lignes de log de cette erreur, pour pouvoir
    // retrouver facilement quelle requete a declenche quelle erreur.
    const logContext = `${request.method} ${request.url}`;
    // Seuil numerique (500) plutot que comparaison directe a l'enum HttpStatus :
    // evite l'erreur ESLint no-unsafe-enum-comparison une fois que statusCode
    // n'est plus garanti d'etre exactement du meme type d'enum des deux cotes.
    const isServerError = statusCode >= 500;
    if (isServerError) {
      // Erreur serveur (bug, panne...) : niveau "error" + stack trace complete
      // pour pouvoir deboguer, mais uniquement dans les logs, jamais dans la reponse HTTP.
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${statusCode} ${logContext}`, stack);
    } else {
      // Erreur "attendue" (400, 401, 404...) : niveau "warn", pas besoin de stack trace
      this.logger.warn(
        `${statusCode} ${logContext} - ${JSON.stringify(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  /**
   * Determine le message a renvoyer au client selon le type d'exception.
   *
   * - Pour une HttpException (levee volontairement dans le code), on reutilise
   *   le message qu'elle transporte deja (ex. "Email deja utilise").
   * - Pour toute autre exception (bug non prevu), on renvoie un message
   *   generique : le message reel de l'erreur peut contenir des details
   *   internes sensibles qui ne doivent jamais atteindre le client.
   */
  private resolveMessage(
    exception: unknown,
    isHttpException: boolean,
  ): string | string[] {
    if (isHttpException) {
      const httpException = exception as HttpException;
      const response = httpException.getResponse();

      // getResponse() peut renvoyer soit une simple chaine, soit un objet
      // (cas notamment des erreurs de validation de class-validator, qui
      // renvoient { message: string[], error: string, statusCode: number }).
      if (typeof response === 'string') {
        return response;
      }
      const responseMessage = (response as { message?: string | string[] })
        .message;
      return responseMessage ?? httpException.message;
    }

    // Ne jamais renvoyer le detail d'une erreur non controlee au client :
    // elle peut contenir des informations sensibles (requete SQL, chemin interne...).
    return 'Erreur interne du serveur';
  }
}
