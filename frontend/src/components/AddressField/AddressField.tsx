import { useState, type FocusEvent, type KeyboardEvent } from 'react';
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
}: AddressFieldProps) {
  // Focus quelque part DANS le champ (input ou une entrée rapide) : piloté par
  // les gestionnaires focus/blur du conteneur, qui se propagent depuis les
  // descendants (React s'appuie sur focusin/focusout). Sert uniquement à
  // décider de l'affichage des entrées rapides - les suggestions du géocodeur,
  // elles, restent pilotées par la seule prop `suggestions` comme avant.
  const [isFocused, setIsFocused] = useState(false);

  const showSuggestions = suggestions.length > 0;
  const showQuickEntries =
    !showSuggestions &&
    isFocused &&
    value.trim() === '' &&
    (quickEntries?.length ?? 0) > 0;

  /**
   * Ferme le dropdown d'entrées rapides uniquement quand le focus quitte
   * réellement le champ (ni l'input ni une entrée) - `relatedTarget` est le
   * futur élément focus. Sans ce test, tabuler de l'input vers la première
   * entrée refermerait la liste avant qu'on puisse l'atteindre.
   */
  function handleContainerBlur(event: FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsFocused(false);
    }
  }

  /** Échap referme le dropdown d'entrées rapides et ramène le focus dans l'input (spec section 2). */
  function handleContainerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && showQuickEntries) {
      setIsFocused(false);
      document.getElementById(id)?.focus();
    }
  }

  return (
    <div
      className="address-field"
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
      {showSuggestions && (
        <ul className="address-suggestions">
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
        </ul>
      )}
      {showQuickEntries && (
        <ul className="address-suggestions address-quick-entries">
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
        </ul>
      )}
    </div>
  );
}

export default AddressField;
