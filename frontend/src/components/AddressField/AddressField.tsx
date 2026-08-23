import FormField from '../FormField/FormField';
import { MapPinIcon } from '../icons';
import type { PlaceSuggestion } from '../../lib/places';
import './AddressField.css';

interface AddressFieldProps {
  id: string;
  label: string;
  value: string;
  suggestions: PlaceSuggestion[];
  error?: string;
  onChange: (value: string) => void;
  onSelect: (place: PlaceSuggestion) => void;
}

/**
 * Champ d'adresse avec autocompletion (issue #35, voir
 * docs/specs/f2-ecrans-planification.md section 2.1) - extrait de
 * RecherchePage.tsx (issue #114) pour etre reutilise par ProfilPage.tsx
 * (domicile/travail, issue #114) sans le recreer. Reutilise FormField pour
 * l'input lui-meme ; la liste de suggestions est une simple liste de
 * boutons (chacun deja focusable/activable au clavier nativement), pas un
 * pattern combobox ARIA complet - suffisant pour ce projet, coherent avec
 * le niveau d'effort d'accessibilite du reste des ecrans qui l'utilisent.
 */
function AddressField({
  id,
  label,
  value,
  suggestions,
  error,
  onChange,
  onSelect,
}: AddressFieldProps) {
  return (
    <div className="address-field">
      <FormField
        id={id}
        label={label}
        icon={<MapPinIcon />}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        error={error}
        autoComplete="off"
      />
      <div aria-live="polite" className="address-field-sr-only">
        {suggestions.length > 0
          ? `${suggestions.length} suggestion(s) disponible(s)`
          : ''}
      </div>
      {suggestions.length > 0 && (
        <ul className="address-suggestions">
          {suggestions.map((suggestion) => (
            <li key={`${suggestion.lat}-${suggestion.lon}`}>
              <button type="button" onClick={() => onSelect(suggestion)}>
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AddressField;
