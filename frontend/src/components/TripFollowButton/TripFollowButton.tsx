import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Alert from '../Alert/Alert';
import Button from '../Button/Button';
import {
  getCurrentFollowedTrip,
  startFollowingTrip,
  stopFollowingTrip,
  toStartFollowingTripInput,
  type FollowedTrip,
} from '../../lib/followedTrip';
import { subscribeBrowserToPush, subscribeToPush } from '../../lib/push';
import type { TripItinerary } from '../../lib/trips';
import { useAuth } from '../../lib/useAuth';
import './TripFollowButton.css';

interface TripFollowButtonProps {
  itinerary: TripItinerary;
}

/**
 * `followedTrip` correspond-il a `itinerary` ? Pas d'identifiant stable
 * entre deux recherches (OTP recalcule integralement a chaque appel, voir
 * OtpClientService) - la destination et l'heure de fin suffisent a
 * distinguer un suivi different d'un simple raffraichissement du meme
 * trajet (deux trajets identiques ne peuvent pas avoir la meme destination
 * ET la meme heure d'arrivee par coincidence dans l'usage normal de l'app).
 */
function matches(
  followedTrip: FollowedTrip | null,
  itinerary: TripItinerary,
): boolean {
  if (!followedTrip) return false;
  const lastSegment = itinerary.segments[itinerary.segments.length - 1];
  return (
    followedTrip.destinationLat === lastSegment.to.lat &&
    followedTrip.destinationLon === lastSegment.to.lon &&
    followedTrip.endTime === itinerary.endTime
  );
}

/**
 * Bouton "Suivre ce trajet" / "Arrêter le suivi" (issue #18,
 * docs/specs/f3-scoring-perturbations-suivi.md section 2) - place dans le
 * panneau detail de l'itineraire selectionne (voir ItinerarySegments,
 * RecherchePageResults.tsx), pas sur chaque carte de la liste : suivre est
 * un choix sur UN itineraire precis, une fois ouvert en detail.
 *
 * Visiteur non connecte (section 3 du meme spec) : le bouton reste visible,
 * son clic renvoie vers /connexion plutot que d'ouvrir le flux d'abonnement -
 * meme traitement que les autres actions du produit qui necessitent un
 * compte.
 */
function TripFollowButton({ itinerary }: TripFollowButtonProps) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [followedTrip, setFollowedTrip] = useState<FollowedTrip | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  // Etat initial du suivi (utile si l'utilisateur revient sur cet
  // itineraire apres l'avoir deja suivi, ou apres un tap sur la
  // notification - voir docs/specs/f3-scoring-perturbations.md section 3.3).
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    getCurrentFollowedTrip().then((result) => {
      if (!cancelled) setFollowedTrip(result);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const isFollowingThis = matches(followedTrip, itinerary);

  async function handleFollow() {
    if (!isAuthenticated) {
      navigate('/connexion');
      return;
    }

    setIsSubmitting(true);
    setPermissionDenied(false);
    try {
      // Le suivi lui-meme n'est jamais bloque par un refus de permission
      // (section 2 du spec de cadrage) - seule la notification systeme en
      // est privee, repli bannière Alert ci-dessous (section 3.4 du spec
      // principal).
      const subscription = await subscribeBrowserToPush();
      if (subscription) {
        await subscribeToPush(subscription).catch(() => {});
      } else {
        setPermissionDenied(true);
      }

      const result = await startFollowingTrip(
        toStartFollowingTripInput(itinerary),
      );
      setFollowedTrip(result);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleStop() {
    setIsSubmitting(true);
    try {
      await stopFollowingTrip();
      setFollowedTrip(null);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="trip-follow">
      <Button
        type="button"
        variant="secondary"
        className="trip-follow-button"
        onClick={() => void (isFollowingThis ? handleStop() : handleFollow())}
        disabled={isSubmitting}
      >
        {isFollowingThis ? 'Arrêter le suivi' : 'Suivre ce trajet'}
      </Button>
      {permissionDenied && (
        <Alert variant="warning" title="Notifications désactivées">
          Vous ne recevrez pas d’alerte automatique en cas de perturbation sur
          ce trajet. Gardez l’application ouverte pour rester informé·e.
        </Alert>
      )}
    </div>
  );
}

export default TripFollowButton;
