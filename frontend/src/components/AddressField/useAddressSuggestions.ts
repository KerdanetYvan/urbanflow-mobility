import { useEffect, useState } from 'react';
import { searchPlaces, type PlaceSuggestion } from '../../lib/places';

/**
 * Suggestions d'autocompletion pour un champ d'adresse (debounce 300ms).
 * Extrait de RecherchePage.tsx (issue #35) vers ce module partage (issue
 * #114) pour etre reutilise par ProfilPage.tsx (domicile/travail) sans
 * dupliquer la logique. Ne relance pas de recherche si le texte correspond
 * deja au libelle de la suggestion selectionnee (evite un aller-retour
 * reseau inutile juste apres un clic sur une suggestion).
 *
 * Fichier separe d'AddressField.tsx (qui n'exporte que le composant) :
 * cette fonction n'en est pas un (nom en camelCase, pas de props), la
 * melanger au composant casserait le fast refresh
 * (react-refresh/only-export-components) - meme motif que
 * components/tripModeIcon.tsx, separe de components/icons.tsx.
 */
export function useAddressSuggestions(
  query: string,
  selectedLabel: string | null,
): PlaceSuggestion[] {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const trimmed = query.trim();
  // "Resolu" = rien a chercher (texte trop court) ou texte deja egal au
  // libelle de la suggestion selectionnee : la liste doit disparaitre
  // immediatement dans ce cas, calcule au rendu plutot que par un setState
  // synchrone dans l'effet (voir react-hooks/set-state-in-effect).
  const isResolved = trimmed.length < 2 || trimmed === selectedLabel;

  useEffect(() => {
    if (isResolved) return;

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      searchPlaces(trimmed)
        .then((results) => {
          if (!cancelled) setSuggestions(results);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmed, isResolved]);

  return isResolved ? [] : suggestions;
}
