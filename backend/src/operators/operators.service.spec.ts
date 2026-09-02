import { OperatorsService } from './operators.service';

function buildService(mobilityOperators: string | undefined) {
  const configService = {
    get: (key: string) =>
      key === 'MOBILITY_OPERATORS' ? mobilityOperators : undefined,
  };
  return new OperatorsService(configService as never);
}

describe('OperatorsService', () => {
  it("renvoie l'operateur par defaut (STAR Rennes) quand MOBILITY_OPERATORS est absente", () => {
    const service = buildService(undefined);

    const operators = service.getOperators();

    expect(operators).toHaveLength(1);
    expect(operators[0]).toMatchObject({ id: 'star-rennes' });
  });

  it("lit plusieurs operateurs depuis MOBILITY_OPERATORS (issue #15, critere 'test avec un flux operateur fictif')", () => {
    const service = buildService(
      JSON.stringify([
        {
          id: 'star-rennes',
          name: 'STAR',
          gbfsDiscoveryUrl: 'https://star.example/gbfs.json',
        },
        {
          id: 'operateur-fictif',
          name: 'Opérateur fictif de test',
          gbfsDiscoveryUrl: 'https://fictif.example/gbfs.json',
          gtfsRealtimeTripUpdatesUrl: 'https://fictif.example/trip-updates',
        },
      ]),
    );

    const operators = service.getOperators();

    expect(operators).toHaveLength(2);
    expect(operators[1]).toEqual({
      id: 'operateur-fictif',
      name: 'Opérateur fictif de test',
      gbfsDiscoveryUrl: 'https://fictif.example/gbfs.json',
      gtfsRealtimeTripUpdatesUrl: 'https://fictif.example/trip-updates',
    });
  });

  it('accepte un operateur ne publiant aucun flux temps reel (seuls id/name obligatoires)', () => {
    const service = buildService(
      JSON.stringify([{ id: 'operateur-minimal', name: 'Opérateur minimal' }]),
    );

    expect(service.getOperators()).toEqual([
      { id: 'operateur-minimal', name: 'Opérateur minimal' },
    ]);
  });

  it('replie sur la valeur par defaut si MOBILITY_OPERATORS est un JSON invalide', () => {
    const service = buildService('{not valid json');

    expect(service.getOperators()[0]).toMatchObject({ id: 'star-rennes' });
  });

  it("replie sur la valeur par defaut si MOBILITY_OPERATORS n'est pas un tableau", () => {
    const service = buildService(
      JSON.stringify({ id: 'star-rennes', name: 'STAR' }),
    );

    expect(service.getOperators()[0]).toMatchObject({ id: 'star-rennes' });
  });

  it('replie sur la valeur par defaut si le tableau ne contient aucune entree valide', () => {
    const service = buildService(
      JSON.stringify([{ gbfsDiscoveryUrl: 'https://x.example' }]),
    );

    expect(service.getOperators()[0]).toMatchObject({ id: 'star-rennes' });
  });

  it("ignore silencieusement une entree invalide au milieu d'entrees valides", () => {
    const service = buildService(
      JSON.stringify([
        { id: 'valide-1', name: 'Valide 1' },
        { id: '', name: 'Sans id' },
        { id: 'valide-2', name: 'Valide 2' },
      ]),
    );

    const operators = service.getOperators();
    expect(operators.map((op) => op.id)).toEqual(['valide-1', 'valide-2']);
  });
});
