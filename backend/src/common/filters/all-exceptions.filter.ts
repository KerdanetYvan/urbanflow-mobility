import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const statusCode: number = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.resolveMessage(exception, isHttpException);

    const body: ErrorResponseBody = {
      statusCode,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    };

    const logContext = `${request.method} ${request.url}`;
    // Comparaison a un seuil numerique plutot qu'a l'enum HttpStatus : eviter
    // no-unsafe-enum-comparison quand statusCode n'est plus garanti du meme type d'enum.
    const isServerError = statusCode >= 500;
    if (isServerError) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      this.logger.error(`${statusCode} ${logContext}`, stack);
    } else {
      this.logger.warn(
        `${statusCode} ${logContext} - ${JSON.stringify(message)}`,
      );
    }

    response.status(statusCode).json(body);
  }

  private resolveMessage(
    exception: unknown,
    isHttpException: boolean,
  ): string | string[] {
    if (isHttpException) {
      const httpException = exception as HttpException;
      const response = httpException.getResponse();
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
