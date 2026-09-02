import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import * as followedTripLib from '../../lib/followedTrip';
import type { FollowedTrip } from '../../lib/followedTrip';
import * as pushLib from '../../lib/push';
import type { TripItinerary } from '../../lib/trips';
import * as useAuthLib from '../../lib/useAuth';
import TripFollowButton from './TripFollowButton';

vi.mock('../../lib/followedTrip');
vi.mock('../../lib/push');
vi.mock('../../lib/useAuth');

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return { ...actual, useNavigate: () => mockNavigate };
});

const ITINERARY: TripItinerary = {
  startTime: '2026-01-15T08:00:00.000Z',
  endTime: '2026-01-15T08:30:00.000Z',
  durationSeconds: 1800,
  transfers: 0,
  segments: [
    {
      mode: 'BUS',
      routeId: 'ligne-a',
      tripId: 'course-1',
      startTime: '2026-01-15T08:00:00.000Z',
      endTime: '2026-01-15T08:30:00.000Z',
      durationSeconds: 1800,
      distanceMeters: 3000,
      from: { name: 'Gare', lat: 48.1, lon: -1.68 },
      to: { name: 'République', lat: 48.11, lon: -1.67 },
      geometry: [
        { lat: 48.1, lon: -1.68 },
        { lat: 48.11, lon: -1.67 },
      ],
    },
  ],
};

function renderButton() {
  return render(
    <MemoryRouter>
      <TripFollowButton itinerary={ITINERARY} />
    </MemoryRouter>,
  );
}

describe('TripFollowButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue(null);
    vi.mocked(followedTripLib.toStartFollowingTripInput).mockReturnValue({
      originLat: 48.1,
      originLon: -1.68,
      destinationLat: 48.11,
      destinationLon: -1.67,
      endTime: ITINERARY.endTime,
      segments: [{ mode: 'BUS', routeId: 'ligne-a', tripId: 'course-1' }],
    });
  });

  it('renvoie vers /connexion au clic, sans demander de permission, pour un visiteur non connecte', async () => {
    vi.mocked(useAuthLib.useAuth).mockReturnValue({
      isAuthenticated: false,
      setAuthenticated: vi.fn(),
    });
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole('button', { name: 'Suivre ce trajet' }));

    expect(mockNavigate).toHaveBeenCalledWith('/connexion');
    expect(pushLib.subscribeBrowserToPush).not.toHaveBeenCalled();
    expect(followedTripLib.startFollowingTrip).not.toHaveBeenCalled();
  });

  it(
    'demarre le suivi (abonnement push + POST /trips/current) au clic pour ' +
      'un utilisateur connecte, puis bascule sur "Arreter le suivi"',
    async () => {
      vi.mocked(useAuthLib.useAuth).mockReturnValue({
        isAuthenticated: true,
        setAuthenticated: vi.fn(),
      });
      vi.mocked(pushLib.subscribeBrowserToPush).mockResolvedValue({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p', auth: 'a' },
      });
      vi.mocked(pushLib.subscribeToPush).mockResolvedValue({ id: 'sub-1' });
      // destinationLat/Lon/endTime doivent correspondre a ITINERARY (voir
      // matches() dans TripFollowButton.tsx) pour que le bouton bascule
      // bien sur "Arreter le suivi" une fois le suivi demarre.
      const followedTrip = {
        id: 'followed-1',
        destinationLat: 48.11,
        destinationLon: -1.67,
        endTime: ITINERARY.endTime,
      } as FollowedTrip;
      vi.mocked(followedTripLib.startFollowingTrip).mockResolvedValue(
        followedTrip,
      );
      const user = userEvent.setup();
      renderButton();

      await user.click(
        screen.getByRole('button', { name: 'Suivre ce trajet' }),
      );

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Arrêter le suivi' }),
        ).toBeInTheDocument();
      });
      expect(pushLib.subscribeBrowserToPush).toHaveBeenCalled();
      expect(pushLib.subscribeToPush).toHaveBeenCalledWith({
        endpoint: 'https://push.example/1',
        keys: { p256dh: 'p', auth: 'a' },
      });
      expect(followedTripLib.startFollowingTrip).toHaveBeenCalled();
    },
  );

  it(
    "demarre quand meme le suivi si la permission de notification est " +
      'refusee (subscribeBrowserToPush resout null), avec une banniere de repli',
    async () => {
      vi.mocked(useAuthLib.useAuth).mockReturnValue({
        isAuthenticated: true,
        setAuthenticated: vi.fn(),
      });
      vi.mocked(pushLib.subscribeBrowserToPush).mockResolvedValue(null);
      vi.mocked(followedTripLib.startFollowingTrip).mockResolvedValue({
        id: 'followed-1',
      } as FollowedTrip);
      const user = userEvent.setup();
      renderButton();

      await user.click(
        screen.getByRole('button', { name: 'Suivre ce trajet' }),
      );

      await waitFor(() => {
        expect(followedTripLib.startFollowingTrip).toHaveBeenCalled();
      });
      expect(pushLib.subscribeToPush).not.toHaveBeenCalled();
      expect(
        screen.getByText('Notifications désactivées'),
      ).toBeInTheDocument();
    },
  );

  it('arrete le suivi au clic sur "Arreter le suivi" et revient a "Suivre ce trajet"', async () => {
    vi.mocked(useAuthLib.useAuth).mockReturnValue({
      isAuthenticated: true,
      setAuthenticated: vi.fn(),
    });
    // Suivi deja actif sur CET itineraire des le montage (meme
    // destination/heure de fin, voir matches() dans TripFollowButton.tsx).
    vi.mocked(followedTripLib.getCurrentFollowedTrip).mockResolvedValue({
      id: 'followed-1',
      destinationLat: 48.11,
      destinationLon: -1.67,
      endTime: ITINERARY.endTime,
    } as FollowedTrip);
    vi.mocked(followedTripLib.stopFollowingTrip).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderButton();

    const stopButton = await screen.findByRole('button', {
      name: 'Arrêter le suivi',
    });
    await user.click(stopButton);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Suivre ce trajet' }),
      ).toBeInTheDocument();
    });
    expect(followedTripLib.stopFollowingTrip).toHaveBeenCalled();
  });

  it(
    "ne charge pas le suivi courant pour un visiteur non connecte " +
      '(getCurrentFollowedTrip degraderait silencieusement de toute facon, mais evite un appel inutile)',
    () => {
      vi.mocked(useAuthLib.useAuth).mockReturnValue({
        isAuthenticated: false,
        setAuthenticated: vi.fn(),
      });
      renderButton();

      expect(followedTripLib.getCurrentFollowedTrip).not.toHaveBeenCalled();
    },
  );
});
