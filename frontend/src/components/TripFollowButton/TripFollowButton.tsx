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
import {
  subscribeBrowserToPush,
  subscribeToPush,
  type PushSubscribeOutcome,
} from '../../lib/push';
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
/** Cause d'echec de l'abonnement push (tout sauf le succes). */
type PushIssue = Exclude<PushSubscribeOutcome['status'], 'subscribed'>;

/**
 * Titre + corps de la bannière de repli affichee quand l'abonnement aux
 * notifications n'a pas abouti (issue #277). Un message par cause : ne
 * jamais laisser croire qu'aucune demande n'a eu lieu quand ce n'est pas le
 * cas, et guider vers les reglages du navigateur quand c'est la seule issue.
 *
 * @param issue la cause d'echec renvoyee par subscribeBrowserToPush
 * @returns le `title` et le `body` a passer au composant Alert
 */
function pushIssueAlert(issue: PushIssue): { title: string; body: string } {
  switch (issue) {
    case 'unsupported':
      return {
        title: 'Notifications indisponibles',
        body: 'Ce navigateur ne gère pas les notifications push. Gardez l’application ouverte pour être prévenu·e d’une perturbation sur ce trajet.',
      };
    case 'server-unconfigured':
      return {
        title: 'Notifications indisponibles',
        body: 'Le service de notifications n’est pas disponible pour le moment. Gardez l’application ouverte pour rester informé·e des perturbations sur ce trajet.',
      };
    case 'permission-blocked':
      return {
        title: 'Notifications bloquées pour ce site',
        body: 'Votre navigateur a mémorisé un refus des notifications pour UrbanFlow et ne réaffiche plus la demande. Pour recevoir les alertes de perturbation, réautorisez les notifications dans les réglages du navigateur, puis relancez le suivi.',
      };
    case 'permission-denied':
      return {
        title: 'Notifications refusées',
        body: 'Vous venez de refuser les notifications. Vous ne recevrez pas d’alerte automatique en cas de perturbation ; gardez l’application ouverte pour rester informé·e.',
      };
    case 'permission-dismissed':
      return {
        title: 'Autorisation non accordée',
        body: 'La demande d’autorisation a été fermée sans réponse. Relancez le suivi pour l’afficher à nouveau et activer les alertes de perturbation.',
      };
    case 'error':
      return {
        title: 'Notifications indisponibles',
        body: 'L’activation des notifications a échoué. Vous ne recevrez pas d’alerte automatique ; gardez l’application ouverte pour rester informé·e.',
      };
  }
}

function matches(
  followedTrip: FollowedTrip | null,
  itinerary: TripItinerary,
): boolean {
  if (!followedTrip) return false;
  // Un itineraire sans segment n'a pas de destination a comparer - ne peut
  // jamais correspondre a un suivi (garde defensive : ce composant est
  // rendu pour tout itineraire affiche, pas seulement au clic sur
  // "Suivre", contrairement a toStartFollowingTripInput qui n'est appelee
  // que sur un itineraire reel deja recu de GET /trips).
  const lastSegment = itinerary.segments.at(-1);
  if (!lastSegment) return false;
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
  // Cause d'echec de l'abonnement push a afficher en repli (issue #277),
  // `null` tant qu'aucune tentative n'a echoue.
  const [pushIssue, setPushIssue] = useState<PushIssue | null>(null);

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
  const pushAlert = pushIssue ? pushIssueAlert(pushIssue) : null;

  async function handleFollow() {
    if (!isAuthenticated) {
      navigate('/connexion');
      return;
    }

    setIsSubmitting(true);
    setPushIssue(null);
    try {
      // Le suivi lui-meme n'est jamais bloque par un refus de permission
      // (section 2 du spec de cadrage) - seule la notification systeme en
      // est privee, repli bannière Alert ci-dessous (section 3.4 du spec
      // principal). Le `status` precis alimente le message de repli (#277).
      const outcome = await subscribeBrowserToPush();
      if (outcome.status === 'subscribed') {
        await subscribeToPush(outcome.subscription).catch(() => {});
      } else {
        setPushIssue(outcome.status);
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
      {pushAlert && (
        <Alert variant="warning" title={pushAlert.title}>
          {pushAlert.body}
        </Alert>
      )}
    </div>
  );
}

export default TripFollowButton;
