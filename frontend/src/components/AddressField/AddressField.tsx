import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  autoUpdate,
  computePosition,
  flip,
  offset,
  shift,
  size,
} from '@floating-ui/dom';
import FormField from '../FormField/FormField';
import { BusIcon, HistoryIcon, MapPinIcon } from '../icons';
import type { PlaceSuggestion } from '../../lib/places';
import './AddressField.css';

/**
 * Entrée rapide affichée dans le dropdown d'`AddressField` quand le champ est
 * vide et a le focus (issue #166, docs/specs/fusion-autocomplete-raccourcis.md) :
 * position GPS, domicile, travail ou adresse récemment recherchée. Le parent
 * (RecherchePage) construit ces entrées à partir de son état (profil,
 * historique, géolocalisation) et fournit le `onSelect` de chacune -
 * `AddressField` reste un composant de présentation sans logique métier.
 *
 * `icon` est volontairement une valeur fermée ('pin' | 'history') plutôt qu'un
 * `ReactNode` : le mapping vers le composant d'icône reste ici, le parent n'a
 * pas à importer les icônes juste pour décrire une entrée.
 */
export interface AddressQuickEntry {
  /** Clé React stable (ex. 'current-position', 'home', 'recent-48.1--1.2'). */
  key: string;
  /** Ligne principale : le rôle de l'entrée ("Domicile") ou, pour une adresse récente, l'adresse elle-même. */
  title: string;
  /** Ligne secondaire atténuée : l'adresse concrète, ou un contexte ("Recherché récemment", "Localisation…"). */
  subtitle: string;
  icon: 'pin' | 'history';
  /** Entrée non actionnable temporairement (ex. position GPS en cours d'acquisition). */
  disabled?: boolean;
  /** Action au clic/activation clavier : remplir le champ, ou déclencher la géolocalisation pour la position. */
  onSelect: () => void;
}

interface AddressFieldProps {
  id: string;
  label: string;
  value: string;
  suggestions: PlaceSuggestion[];
  error?: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
  /**
   * Entrées rapides (position/domicile/travail/historique) proposées au focus
   * quand le champ est vide. Absentes (cas par défaut, ex. ProfilPage) : le
   * champ ne montre que les suggestions du géocodeur à partir de 2 caractères,
   * comportement historique inchangé (issue #166, spec section 6).
   */
  quickEntries?: AddressQuickEntry[];
  /**
   * Rendu compact (issue #233, champs origine/destination de /recherche) :
   * transmis tel quel à `FormField` - voir son commentaire pour le detail
   * (label toujours dans le DOM, juste masque visuellement).
   */
  hideLabel?: boolean;
  /**
   * Un AUTRE overlay concurrent est ouvert ailleurs dans l'ecran (issue
   * #252, ex. la modale de filtres de RecherchePage) : force la fermeture
   * du dropdown de CE champ (suggestions ET entrées rapides), même s'il a
   * le focus ou que des suggestions existent déjà. Absent = comportement
   * normal (ex. ProfilPage, qui n'a pas d'overlay concurrent).
   *
   * Sens unique volontaire (pas de prop symetrique cote modale) : verifie
   * en session que l'inverse (ouvrir CE dropdown pendant que la modale de
   * filtres est deja ouverte) est deja impossible via une interaction
   * normale - le fond `.recherche-filters-backdrop` de la modale intercepte
   * deja tout clic vers les champs situes derriere elle, et son piege de
   * focus (RecherchePage.tsx, SearchFiltersModal) empeche deja Tab d'en
   * sortir. Ajouter une fermeture reciproque aurait ete du code mort.
   */
  forceClosed?: boolean;
}

/**
 * Champ d'adresse avec autocomplétion (issue #35, voir
 * docs/specs/f2-ecrans-planification.md section 2.1) - extrait de
 * RecherchePage.tsx (issue #114) pour être réutilisé par ProfilPage.tsx
 * (domicile/travail, issue #114) sans le recréer. Réutilise FormField pour
 * l'input lui-même ; la liste de suggestions est une simple liste de
 * boutons (chacun déjà focusable/activable au clavier nativement), pas un
 * pattern combobox ARIA complet - suffisant pour ce projet, cohérent avec
 * le niveau d'effort d'accessibilité du reste des écrans qui l'utilisent.
 *
 * Deux contenus possibles pour le dropdown, jamais simultanés (issue #166) :
 * - les suggestions du géocodeur (`suggestions`, calculées par le parent via
 *   useAddressSuggestions dès 2 caractères) ;
 * - à défaut, si le champ est vide et a le focus, les entrées rapides
 *   (`quickEntries`).
 * Dès qu'un caractère est saisi (champ non vide) sans atteindre le seuil du
 * géocodeur, le dropdown est fermé : ni entrées rapides (plus pertinentes),
 * ni suggestions (pas encore disponibles).
 *
 * Positionnement flottant (issue #233, retour utilisateur en session) : le
 * dropdown était auparavant un simple `position: absolute; top: 100%`,
 * imbriqué dans le DOM de la carte de recherche - dès qu'il dépassait la
 * hauteur visible de celle-ci, il déclenchait un scroll INTERNE à la carte
 * (`overflow-y: auto` sur le panneau, voir RecherchePageResults.css) plutôt
 * que de s'afficher par-dessus. Il est désormais porté hors de ce flux via
 * un React Portal (`createPortal` vers `document.body`) et positionné par
 * `@floating-ui/dom` : `flip()` le bascule au-dessus du champ s'il n'y a
 * pas assez de place en dessous, `shift()` le recale horizontalement plutôt
 * que de déborder du viewport, `size()` calcule une largeur minimale (celle
 * du champ, jamais plus étroit) et maximale (l'espace disponible jusqu'au
 * bord du viewport - le dropdown peut s'élargir pour une suggestion plus
 * longue que le champ, `.address-suggestion-label` ne tronque plus qu'en
 * dernier recours si même cette largeur maximale ne suffit pas).
 */
function AddressField({
  id,
  label,
  value,
  suggestions,
  error,
  onChange,
  onSelect,
  quickEntries,
  hideLabel,
  forceClosed,
}: AddressFieldProps) {
  // Focus quelque part DANS le champ (input ou une entrée rapide) : piloté par
  // les gestionnaires focus/blur du conteneur, qui se propagent depuis les
  // descendants (React s'appuie sur focusin/focusout). Sert uniquement à
  // décider de l'affichage des entrées rapides - les suggestions du géocodeur,
  // elles, restent pilotées par la seule prop `suggestions` comme avant.
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  // Callback ref plutôt qu'un useRef classique : le <ul> ne monte QUE quand
  // le dropdown est ouvert (rendu conditionnel), il faut être notifié dès
  // qu'il apparaît/disparaît pour (dés)activer le positionnement flottant
  // (effet ci-dessous, dépendant de floatingEl).
  const [floatingEl, setFloatingEl] = useState<HTMLUListElement | null>(null);

  // !forceClosed (issue #252) integre directement ici plutot qu'au moment
  // du rendu des 2 portails plus bas : les deux booleens restent la seule
  // source de verite pour "ce dropdown particulier doit-il s'afficher",
  // qu'on la consulte pour choisir QUEL contenu montrer ou pour decider
  // s'il faut l'empecher entierement (overlay concurrent ouvert ailleurs).
  const showSuggestions = suggestions.length > 0 && !forceClosed;
  const showQuickEntries =
    !showSuggestions &&
    isFocused &&
    value.trim() === '' &&
    (quickEntries?.length ?? 0) > 0 &&
    !forceClosed;
  const isOpen = showSuggestions || showQuickEntries;

  // Positionne le dropdown porté en portal (voir le commentaire du composant
  // ci-dessus pour le détail de chaque middleware). Repositionnement
  // imperatif direct sur le style DOM (pas via un state React) - pattern
  // recommandé par @floating-ui/dom : `autoUpdate` peut appeler ce callback
  // à haute fréquence (scroll, resize), le faire passer par un re-rendu
  // React à chaque fois serait couteux pour un simple changement de
  // position/taille.
  useEffect(() => {
    const reference = containerRef.current;
    if (!isOpen || !reference || !floatingEl) return;

    function updatePosition() {
      // Réinitialise les contraintes de taille posées par size() au calcul
      // précédent AVANT de relancer computePosition. Sans ça, flip() (qui
      // s'exécute avant size() dans la chaîne ci-dessous) mesure un dropdown
      // déjà rétréci au tour d'avant : il le voit « rentrer » sous le champ
      // même quand la place réelle manque, et ne bascule donc jamais
      // au-dessus. Résultat : sur le champ Destination (bas de la colonne,
      // près du bord bas de l'écran) le dropdown restait coincé en dessous,
      // écrasé à quelques dizaines de pixels avec un scroll interne. En
      // repartant de la taille naturelle à chaque calcul, flip() décide
      // correctement, puis size() ne plafonne qu'ensuite (gotcha documenté
      // par @floating-ui quand flip() précède size()).
      floatingEl!.style.minWidth = '';
      floatingEl!.style.maxWidth = '';
      floatingEl!.style.maxHeight = '';

      void computePosition(reference!, floatingEl!, {
        placement: 'bottom-start',
        middleware: [
          offset(4),
          flip({ padding: 8 }),
          shift({ padding: 8 }),
          size({
            padding: 8,
            apply({ availableWidth, availableHeight, rects }) {
              Object.assign(floatingEl!.style, {
                minWidth: `${rects.reference.width}px`,
                maxWidth: `${Math.max(rects.reference.width, availableWidth)}px`,
                // 22rem (352px a la racine par defaut) : meme plafond que
                // l'ancien `max-height` fixe (AddressField.css), en plus
                // du plafond dynamique lie a l'espace reellement dispo.
                maxHeight: `${Math.min(availableHeight, 352)}px`,
              });
            },
          }),
        ],
      }).then(({ x, y }) => {
        Object.assign(floatingEl!.style, { left: `${x}px`, top: `${y}px` });
      });
    }

    return autoUpdate(reference, floatingEl, updatePosition);
  }, [isOpen, floatingEl]);

  /**
   * Fermeture "deliberee" (Echap, bouton "Fermer") : rend le focus au
   * declencheur, comme demande par la spec section 3. Le clic exterieur
   * (voir l'ecouteur ci-dessous) ne passe PAS par cette fonction - un clic
   * en dehors a deja porte le focus sur sa propre cible (ex. le champ
   * Destination), le lui reprendre de force romprait ce que l'utilisateur
   * vient de faire ; seules Echap/"Fermer" n'ont pas de cible de focus
   * concurrente a respecter.
   */
  function close() {
    setIsFocused(false);
  }

  /**
   * Ferme le dropdown uniquement quand le focus quitte reellement le champ
   * ET le dropdown - `relatedTarget` est le futur element focus. Verifie
   * les deux conteneurs (pas seulement `.address-field`, issue #233) : le
   * dropdown vit desormais dans un portal vers `document.body`, donc hors
   * du sous-arbre DOM de `.address-field` - sans ce second test, tabuler
   * ou cliquer de l'input vers une suggestion refermerait le dropdown
   * avant qu'on puisse l'atteindre.
   */
  function handleContainerBlur(event: FocusEvent<HTMLDivElement>) {
    const next = event.relatedTarget as Node | null;
    if (
      !event.currentTarget.contains(next) &&
      !floatingEl?.contains(next)
    ) {
      close();
    }
  }

  /** Échap referme le dropdown d'entrées rapides et ramène le focus dans l'input (spec section 2). */
  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && showQuickEntries) {
      close();
      document.getElementById(id)?.focus();
    }
  }

  return (
    <div
      className="address-field"
      ref={containerRef}
      onFocus={() => setIsFocused(true)}
      onBlur={handleContainerBlur}
      onKeyDown={handleContainerKeyDown}
    >
      <FormField
        id={id}
        label={label}
        icon={<MapPinIcon />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        autoComplete="off"
        hideLabel={hideLabel}
      />
      <div aria-live="polite" className="address-field-sr-only">
        {showSuggestions
          ? `${suggestions.length} suggestion(s) disponible(s)`
          : showQuickEntries
            ? `${quickEntries!.length} raccourci(s) disponible(s)`
            : ''}
      </div>
      {showSuggestions &&
        createPortal(
          <ul className="address-suggestions" ref={setFloatingEl}>
            {suggestions.map((suggestion) => (
              <li key={`${suggestion.lat}-${suggestion.lon}`}>
                <button
                  type="button"
                  className="address-suggestion"
                  onClick={() => onSelect(suggestion)}
                >
                  {/* Puce transport pour un arrêt (géocodeur OTP), épingle pour
                      une adresse (Nominatim) ou un résultat sans `kind` connu
                      (issue #168). */}
                  <span className="address-suggestion-icon" aria-hidden="true">
                    {suggestion.kind === 'stop' ? <BusIcon /> : <MapPinIcon />}
                  </span>
                  <span className="address-suggestion-label">
                    {suggestion.label}
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
      {showQuickEntries &&
        createPortal(
          <ul
            className="address-suggestions address-quick-entries"
            ref={setFloatingEl}
          >
            {quickEntries!.map((entry) => (
              <li key={entry.key}>
                <button
                  type="button"
                  className="address-quick-entry"
                  disabled={entry.disabled}
                  // Empêche le clic de retirer le focus de l'input : le dropdown
                  // reste ouvert le temps de l'action (utile pour la position
                  // GPS, qui passe l'entrée en "Localisation…" sans fermer la
                  // liste). N'affecte pas l'activation au clavier.
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={entry.onSelect}
                >
                  <span className="address-quick-entry-icon" aria-hidden="true">
                    {entry.icon === 'history' ? <HistoryIcon /> : <MapPinIcon />}
                  </span>
                  <span className="address-quick-entry-text">
                    <span className="address-quick-entry-title">{entry.title}</span>
                    <span className="address-quick-entry-subtitle">
                      {entry.subtitle}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>,
          document.body,
        )}
    </div>
  );
}

export default AddressField;
