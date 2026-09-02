import { useEffect, useState } from 'react';

/**
 * Etat de connexion du navigateur (F2, issue #10 - "mode dégradé"),
 * `navigator.onLine` + evenements `online`/`offline` de l'API standard.
 * Sert a afficher un etat degrade EXPLICITE (AppLayout, bandeau
 * permanent) plutot que de laisser chaque appel reseau echouer
 * silencieusement un par un.
 *
 * Limite connue de `navigator.onLine` (documentee MDN) : reflete la
 * connexion au reseau local (Wi-Fi/Ethernet associe), pas une jointure
 * reelle a Internet ni au backend de l'app - un faux negatif ("en ligne"
 * alors que le backend est injoignable) reste possible. Le repli sur le
 * cache local (voir lib/tripCache.ts) se declenche donc aussi
 * independamment, sur l'echec reel d'un appel reseau, pas seulement sur
 * cet indicateur.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}
