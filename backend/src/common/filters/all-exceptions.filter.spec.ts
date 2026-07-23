import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * Construit un faux ArgumentsHost minimal, sans avoir besoin de monter une
 * vraie requete HTTP Express. On ne simule que ce dont AllExceptionsFilter
 * a besoin : `getRequest()` (method/url) et `getResponse()` (status().json()).
 *
 * `status` et `json` sont des jest.fn() : on peut ensuite verifier avec quels
 * arguments ils ont ete appeles (expect(status).toHaveBeenCalledWith(...)).
 */
function createHost(url = '/trips') {
  const json = jest.fn();
  // response.status(code) doit renvoyer un objet avec .json() (chainage Express) :
  // mockReturnValue({ json }) reproduit ce chainage.
  const status = jest.fn().mockReturnValue({ json });
  const response = { status };
  const request = { method: 'GET', url };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it("propage le statut et le message d'une HttpException", () => {
    const { host, status, json } = createHost();
    // BadRequestException('Champ invalide') est le cas d'usage le plus courant :
    // une erreur levee volontairement dans un controleur/service.
    filter.catch(new BadRequestException('Champ invalide'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Champ invalide',
        path: '/trips',
      }),
    );
  });

  it('propage un tableau de messages de validation', () => {
    const { host, json } = createHost();
    // Cas des erreurs de validation (class-validator) : le message est un
    // tableau (un element par champ en erreur), pas une simple chaine.
    filter.catch(
      new BadRequestException({
        message: ['email invalide', 'mot de passe trop court'],
      }),
      host,
    );

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: ['email invalide', 'mot de passe trop court'],
      }),
    );
  });

  it("masque le detail d'une erreur non controlee derriere un message generique", () => {
    const { host, status, json } = createHost();
    // Une Error() classique (pas une HttpException) simule un bug non prevu,
    // par exemple une exception remontee par TypeORM. Le message reel
    // ("secret de connexion a la base") ne doit JAMAIS atteindre le client.
    filter.catch(new Error('secret de connexion a la base'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Erreur interne du serveur',
      }),
    );
  });
});
