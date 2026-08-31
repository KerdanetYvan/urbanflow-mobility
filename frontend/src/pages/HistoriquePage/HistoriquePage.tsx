import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../../components/Alert/Alert';
import Button from '../../components/Button/Button';
import { HistoryIcon } from '../../components/icons';
import Skeleton from '../../components/Skeleton/Skeleton';
import { ApiError } from '../../lib/api';
import { formatCoordinates } from '../../lib/format';
import {
  entryToPlaces,
  getTripHistory,
  type TripHistoryEntry,
} from '../../lib/trips';
import { useAuth } from '../../lib/useAuth';
import './HistoriquePage.css';

/**
 * Formate une date ISO en date + heure courtes ("15 août, 14:05"), utilise
 * pour afficher la derniere recherche d'une entree d'historique. Format
 * different de formatTime (lib/format.ts, heure seule) : une entree
 * d'historique peut dater de plusieurs jours, contrairement aux horaires de
 * depart/arrivee d'un itineraire deja en cours d'affichage.
 */
function formatLastSearched(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Une entree de la liste d'historique - simple resume texte (pas de carte ni
 * de trace), le detail complet de l'itineraire n'est plus disponible une
 * fois la recherche passee (seuls origine/destination/date sont conserves,
 * voir TripHistoryEntry). Bouton "Relancer cette recherche" (issue #174) :
 * navigue vers /recherche en transmettant origine/destination via l'etat de
 * navigation React Router - RecherchePage se charge ensuite de relancer la
 * recherche elle-meme (meme logique que les raccourcis de recherche rapide,
 * issue #112), rien n'est duplique ici.
 */
function HistoryEntryCard({ entry }: { entry: TripHistoryEntry }) {
  const navigate = useNavigate();

  function handleRelaunch() {
    const { origin, destination } = entryToPlaces(entry);
    navigate('/recherche', { state: { origin, destination } });
  }

  return (
    <li className="historique-entry">
      <div className="historique-entry-route">
        <span className="historique-entry-endpoint">
          {entry.originLabel ??
            formatCoordinates(entry.originLat, entry.originLon)}
        </span>
        <span className="historique-entry-arrow" aria-hidden="true">→</span>
        <span className="historique-entry-endpoint">
          {entry.destinationLabel ??
            formatCoordinates(entry.destinationLat, entry.destinationLon)}
        </span>
      </div>
      <p className="historique-entry-date">
        Recherché le {formatLastSearched(entry.lastSearchedAt)}
      </p>
      <Button
        type="button"
        variant="secondary"
        className="historique-entry-relaunch"
        onClick={handleRelaunch}
      >
        Relancer cette recherche
      </Button>
    </li>
  );
}

/**
 * Ecran d'historique des trajets recents (F2, issue #11).
 *
 * Charge GET /trips/history au montage - necessite un compte (route
 * enveloppee dans RequireAuth, voir App.tsx). Chaque recherche authentifiee
 * lancee depuis /recherche est enregistree automatiquement cote backend
 * (TripsService#search), rien a declencher explicitement ici.
 */
function HistoriquePage() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [entries, setEntries] = useState<TripHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const history = await getTripHistory();
        if (cancelled) return;
        setEntries(history);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof ApiError && err.statusCode === 401) {
          // authGet a deja nettoye les jetons invalides (voir lib/api.ts) :
          // meme garde que ProfilPage - resynchronise le contexte pour que
          // la nav (AppLayout) arrete immediatement de proposer Profil/
          // Historique.
          setAuthenticated(false);
          navigate('/connexion');
        } else {
          setError("Impossible de charger l'historique pour le moment.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navigate, setAuthenticated]);

  if (isLoading) {
    return (
      <section className="historique-page">
        <h1>Historique</h1>
        <Skeleton count={3} />
      </section>
    );
  }

  if (error) {
    return (
      <section className="historique-page">
        <h1>Historique</h1>
        <Alert variant="error" title="Erreur">
          {error}
        </Alert>
      </section>
    );
  }

  return (
    <section className="historique-page">
      <h1>Historique</h1>
      {entries.length === 0 ? (
        <div className="historique-empty">
          <span className="historique-empty-icon" aria-hidden="true">
            <HistoryIcon />
          </span>
          <p>L'historique des trajets récents sera affiché ici.</p>
        </div>
      ) : (
        <ul className="historique-list">
          {entries.map((entry) => (
            <HistoryEntryCard key={entry.id} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

export default HistoriquePage;
