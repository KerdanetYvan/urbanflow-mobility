import {
  clearRechercheSessionState,
  loadRechercheSessionState,
  saveRechercheSessionState,
  type RechercheSessionState,
} from './rechercheSessionState';

const STATE: RechercheSessionState = {
  screen: { kind: 'formulaire' },
  origin: { query: 'Gare', selected: { label: 'Gare Part-Dieu', lat: 45.76, lon: 4.86 } },
  destination: { query: '', selected: null },
  departureTime: '',
  selectedModes: ['BUS'],
};

describe('rechercheSessionState (issue #266)', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("ne renvoie rien tant qu'aucune recherche n'a ete sauvegardee", () => {
    expect(loadRechercheSessionState()).toBeNull();
  });

  it('retrouve exactement ce qui a ete sauvegarde', () => {
    saveRechercheSessionState(STATE);

    expect(loadRechercheSessionState()).toEqual(STATE);
  });

  it('sauvegarde un etat "resultats" complet (itineraires, repli, mode degrade)', () => {
    const withResults: RechercheSessionState = {
      ...STATE,
      screen: {
        kind: 'resultats',
        origin: STATE.origin.selected!,
        destination: { label: 'Hôtel de Ville', lat: 45.77, lon: 4.83 },
        itineraries: [
          { startTime: 't0', endTime: 't1', durationSeconds: 600, transfers: 0, segments: [] },
        ],
        fromCache: true,
      },
    };
    saveRechercheSessionState(withResults);

    expect(loadRechercheSessionState()).toEqual(withResults);
  });

  it('clearRechercheSessionState efface la recherche sauvegardee', () => {
    saveRechercheSessionState(STATE);

    clearRechercheSessionState();

    expect(loadRechercheSessionState()).toBeNull();
  });

  it("degrade silencieusement (pas d'exception) si sessionStorage contient un JSON corrompu", () => {
    sessionStorage.setItem('urbanflow.rechercheSession.v1', '{not valid json');

    expect(loadRechercheSessionState()).toBeNull();
  });

  it("n'echoue pas quand rien n'est a purger", () => {
    expect(() => clearRechercheSessionState()).not.toThrow();
  });
});
