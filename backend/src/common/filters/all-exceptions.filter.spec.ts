import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

function createHost(url = '/trips') {
  const json = jest.fn();
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
