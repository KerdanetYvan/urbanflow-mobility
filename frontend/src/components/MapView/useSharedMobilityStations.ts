import { useEffect, useState } from 'react';
import {
  fetchSharedMobilityStations,
  type SharedMobilityStation,
} from '../../lib/sharedMobility';

/**
 * Frequence de rafraichissement cote frontend (issue #13) - alignee sur la
 * cadence de rafraichissement du cache backend (GbfsCacheService,
 * `@Cron(EVERY_MINUTE)`) : interroger plus souvent ne renverrait aucune
 * donnee plus fraiche, juste des appels reseau inutiles (eco-conception,
 * CLAUDE.md).
 */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Stations/vehicules en libre-service (velos, trottinettes) affiches sur la
 * carte (MapView) - issue #13. Charge au montage puis toutes les
 * REFRESH_INTERVAL_MS tant que le composant reste monte (la carte est un
 * fond permanent de l'ecran de recherche, voir issue #110 - jamais
 * demontee/remontee au fil d'une session de recherche).
 *
 * Extrait dans ce hook dedie plutot que garde en ligne dans MapView.tsx :
 * meme raisonnement que useAddressSuggestions.ts (components/AddressField/) -
 * la logique de fetch/poll est independante du rendu de la carte.
 *
 * Degradation (echec reseau ou backend indisponible) : conserve simplement
 * la derniere liste connue (jamais de crash, jamais d'etat d'erreur affiche -
 * l'absence de stations a jour n'est jamais bloquante pour l'ecran de
 * recherche).
 */
export function useSharedMobilityStations(): SharedMobilityStation[] {
  const [stations, setStations] = useState<SharedMobilityStation[]>([]);

  useEffect(() => {
    let cancelled = false;

    function load() {
      fetchSharedMobilityStations()
        .then((result) => {
          if (!cancelled) setStations(result);
        })
        .catch(() => {
          // Degradation silencieuse (voir docstring) - la derniere liste
          // connue reste affichee.
        });
    }

    load();
    const intervalId = setInterval(load, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, []);

  return stations;
}
