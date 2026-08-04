import { useEffect, useRef, useState } from 'react';

export interface GeoPosition {
  lat: number;
  lon: number;
}

export type GeolocationStatus =
  | 'idle'
  | 'watching'
  | 'denied'
  | 'unsupported'
  | 'error';

export interface GeolocationState {
  status: GeolocationStatus;
  position: GeoPosition | null;
}

/**
 * Options de `watchPosition` (issue #9) - eco-conception (CLAUDE.md,
 * "limiter les appels reseau superflus" s'etend ici a la sollicitation du
 * capteur GPS, gourmand en energie) :
 * - `enableHighAccuracy: false` : evite le GPS haute precision, le
 *   positionnement approximatif (wifi/cellulaire) suffit pour situer
 *   l'utilisateur sur la carte d'un itineraire.
 * - `maximumAge` : accepte une position mise en cache par le navigateur
 *   jusqu'a cette duree plutot que d'exiger une lecture fraiche a chaque
 *   fois.
 */
const WATCH_OPTIONS: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 30_000,
  timeout: 10_000,
};

/**
 * Frequence de mise a jour maitrisee (issue #9, critere d'acceptation
 * dedie) : le navigateur peut appeler le callback de `watchPosition` bien
 * plus souvent que necessaire pour l'usage de cet ecran (suivre un
 * itineraire, pas un tracking precis a la seconde) - les mises a jour plus
 * rapprochees que ce seuil sont ignorees.
 */
const MIN_UPDATE_INTERVAL_MS = 15_000;

/**
 * Position de l'utilisateur en temps reel (issue #9), via la Geolocation
 * API du navigateur. `enabled` controle l'abonnement (pas de sollicitation
 * du capteur GPS tant que la carte qui l'affiche n'est pas visible, voir
 * ResultatsPage).
 *
 * Permission refusee (AC dediee) : `status` passe a 'denied', jamais
 * d'exception non geree - a l'appelant d'afficher un message adapte s'il le
 * souhaite (voir ResultsList, ResultatsPage.tsx).
 */
export function useGeolocation(enabled: boolean): GeolocationState {
  // Support de l'API calcule dans l'initialiseur (paresseux, execute une
  // seule fois au montage) plutot que dans l'effet ci-dessous : evite un
  // setState synchrone pour une information deja connue avant meme le
  // premier rendu (voir react-hooks/set-state-in-effect).
  const [state, setState] = useState<GeolocationState>(() =>
    navigator.geolocation
      ? { status: 'idle', position: null }
      : { status: 'unsupported', position: null },
  );
  const lastUpdateAtRef = useRef(0);

  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;

    // Pas de setState('watching') synchrone ici (voir
    // react-hooks/set-state-in-effect) : le statut passe directement de
    // 'idle' a 'watching'/'denied'/'error' via les callbacks ci-dessous, des
    // que le navigateur repond reellement - aucun consommateur actuel de ce
    // hook ne distingue 'idle' de "en attente de la premiere reponse".
    const watchId = navigator.geolocation.watchPosition(
      (result) => {
        const now = Date.now();
        if (now - lastUpdateAtRef.current < MIN_UPDATE_INTERVAL_MS) return;
        lastUpdateAtRef.current = now;
        setState({
          status: 'watching',
          position: {
            lat: result.coords.latitude,
            lon: result.coords.longitude,
          },
        });
      },
      (error) => {
        setState({
          status:
            error.code === error.PERMISSION_DENIED ? 'denied' : 'error',
          position: null,
        });
      },
      WATCH_OPTIONS,
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled]);

  return state;
}
