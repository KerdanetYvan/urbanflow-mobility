import { act, renderHook } from '@testing-library/react';
import { useMapSafeAreaPadding } from './useMapSafeAreaPadding';

/** Remplace le stub par defaut de test/setup.ts (matches: false) - meme motif que useGlyphScale.spec.ts. */
function stubDesktopMediaQuery(matches: boolean) {
  vi.stubGlobal('matchMedia', () => ({
    matches,
    media: '(min-width: 768px)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

/**
 * Remplace le stub globalement no-op de test/setup.ts (ResizeObserverStub -
 * ignore l'element observe, ne declenche jamais son callback) par une
 * variante pilotable : necessaire ici, contrairement aux autres tests de ce
 * projet qui ne verifient que l'absence de crash au montage (voir le
 * commentaire de test/setup.ts), ce hook a precisement pour but de
 * recalculer quand un panneau observe change de taille.
 */
function stubControllableResizeObserver() {
  const instances: { callback: ResizeObserverCallback; elements: Set<Element> }[] = [];
  class ControllableResizeObserver {
    private readonly entry: { callback: ResizeObserverCallback; elements: Set<Element> };
    constructor(callback: ResizeObserverCallback) {
      this.entry = { callback, elements: new Set() };
      instances.push(this.entry);
    }
    observe(element: Element) {
      this.entry.elements.add(element);
    }
    unobserve(element: Element) {
      this.entry.elements.delete(element);
    }
    disconnect() {
      this.entry.elements.clear();
    }
  }
  vi.stubGlobal('ResizeObserver', ControllableResizeObserver);
  return {
    trigger() {
      for (const { callback, elements } of instances) {
        callback(
          Array.from(elements).map((target) => ({ target }) as ResizeObserverEntry),
          {} as ResizeObserver,
        );
      }
    },
  };
}

/** Rectangle jsdom par defaut (toujours a zero, aucun moteur de layout reel) - on le remplace par une valeur mockee explicite. */
function mockRect(el: HTMLElement, rect: Partial<DOMRect>) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...rect,
  });
}

describe('useMapSafeAreaPadding (issue #273, cadrage carte vs panneaux flottants)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sans panneau monte (ref.current null) : padding par defaut (24/24 partout)', () => {
    stubDesktopMediaQuery(true);
    const formPanelRef = { current: null };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));

    expect(result.current).toEqual({
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, 24],
    });
  });

  it("desktop : reserve depuis la GAUCHE jusqu'au bord droit du panneau formulaire", () => {
    stubDesktopMediaQuery(true);
    const formEl = document.createElement('div');
    mockRect(formEl, { right: 376 });
    const formPanelRef = { current: formEl };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));

    expect(result.current).toEqual({
      paddingTopLeft: [400, 24], // 376 + marge de 24
      paddingBottomRight: [24, 24],
    });
  });

  it('desktop : le panneau de detail, quand present, etend la reserve jusqu\'a son propre bord droit', () => {
    stubDesktopMediaQuery(true);
    const formEl = document.createElement('div');
    mockRect(formEl, { right: 376 });
    const detailEl = document.createElement('div');
    mockRect(detailEl, { right: 712 });
    const formPanelRef = { current: formEl };
    const detailPanelRef = { current: detailEl };

    const { result } = renderHook(() =>
      useMapSafeAreaPadding(formPanelRef, detailPanelRef, true),
    );

    expect(result.current.paddingTopLeft).toEqual([736, 24]); // 712 + 24
  });

  it('desktop : un panneau de detail present dans le DOM mais NON signale (detailPanelPresent=false) est ignore', () => {
    stubDesktopMediaQuery(true);
    const formEl = document.createElement('div');
    mockRect(formEl, { right: 376 });
    const detailEl = document.createElement('div');
    mockRect(detailEl, { right: 712 });
    const formPanelRef = { current: formEl };
    const detailPanelRef = { current: detailEl };

    const { result } = renderHook(() =>
      useMapSafeAreaPadding(formPanelRef, detailPanelRef, false),
    );

    expect(result.current.paddingTopLeft).toEqual([400, 24]); // seul le panneau formulaire compte
  });

  it("mobile : reserve depuis le BAS jusqu'au sommet du bandeau, jamais depuis la gauche/droite", () => {
    stubDesktopMediaQuery(false);
    const formEl = document.createElement('div');
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    mockRect(formEl, { top: 600 });
    const formPanelRef = { current: formEl };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));

    expect(result.current).toEqual({
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, 224], // (800 - 600) + 24
    });
  });

  it('recalcule quand un panneau observe change de taille (ResizeObserver)', () => {
    stubDesktopMediaQuery(true);
    const resizeObserver = stubControllableResizeObserver();
    const formEl = document.createElement('div');
    mockRect(formEl, { right: 376 });
    const formPanelRef = { current: formEl };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));
    expect(result.current.paddingTopLeft).toEqual([400, 24]);

    mockRect(formEl, { right: 420 }); // le panneau grandit (ex. plus de resultats)
    act(() => {
      resizeObserver.trigger();
    });

    expect(result.current.paddingTopLeft).toEqual([444, 24]);
  });

  it("recalcule a la fin de la transition CSS du bandeau mobile (repli/deploiement, transitionend)", () => {
    stubDesktopMediaQuery(false);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const formEl = document.createElement('div');
    mockRect(formEl, { top: 600 });
    const formPanelRef = { current: formEl };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));
    expect(result.current.paddingBottomRight).toEqual([24, 224]);

    // Repli du bandeau (translateY) : le sommet remonte pres du bas de l'ecran.
    mockRect(formEl, { top: 756 });
    act(() => {
      formEl.dispatchEvent(new Event('transitionend'));
    });

    expect(result.current.paddingBottomRight).toEqual([24, 68]); // (800 - 756) + 24
  });

  it("recalcule sur mutation de data-sheet-state meme sans transition (prefers-reduced-motion)", async () => {
    stubDesktopMediaQuery(false);
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(800);
    const formEl = document.createElement('div');
    formEl.setAttribute('data-sheet-state', 'expanded');
    mockRect(formEl, { top: 600 });
    const formPanelRef = { current: formEl };

    const { result } = renderHook(() => useMapSafeAreaPadding(formPanelRef));
    expect(result.current.paddingBottomRight).toEqual([24, 224]);

    mockRect(formEl, { top: 756 });
    await act(async () => {
      formEl.setAttribute('data-sheet-state', 'collapsed');
      // MutationObserver (reel dans jsdom, pas stubbe) notifie en microtache.
      await Promise.resolve();
    });

    expect(result.current.paddingBottomRight).toEqual([24, 68]);
  });
});
