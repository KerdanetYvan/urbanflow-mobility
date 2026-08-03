import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import MapView from '../../components/MapView/MapView';
import { getModeStyle } from '../../components/MapView/modeStyles';
import { getTripModeIcon } from '../../components/tripModeIcon';
import {
  formatDuration,
  formatTime,
  formatTransfers,
} from '../../lib/format';
import type { PlaceSuggestion } from '../../lib/places';
import type { TripItinerary } from '../../lib/trips';
import './ResultatsPage.css';

/**
 * Forme de l'etat de navigation transmis par RecherchePage (#35) au succes
 * d'une recherche - voir docs/specs/f2-ecrans-planification.md section 2.4.
 * Ecart volontaire par rapport a la spec stricte (qui prevoit de transmettre
 * les criteres de recherche) : #35 transmet directement les itineraires deja
 * recherches aupres de GET /trips, donc cet ecran n'appelle pas l'API
 * lui-meme - pas de logique de nouvel appel/retry a prevoir ici.
 */
interface ResultatsLocationState {
  itineraries: TripItinerary[];
  origin: PlaceSuggestion;
  destination: PlaceSuggestion;
}

/**
 * Modes de transport uniques utilises par un itineraire, dans l'ordre de
 * premiere apparition des segments (meme logique que MapView#modesUsed).
 */
function modesUsedBy(itinerary: TripItinerary): string[] {
  return [...new Set(itinerary.segments.map((segment) => segment.mode))];
}

interface ItineraryCardProps {
  itinerary: TripItinerary;
  isSelected: boolean;
  onSelect: () => void;
}

/**
 * Carte-itineraire de la liste de resultats (section 3.1 de la spec) : toute
 * la carte est l'unite tactile/clavier (un unique <button>), pas seulement
 * un lien "Voir le detail" - un <button> natif donne le comportement clavier
 * (Tab, Entree, Espace) sans code supplementaire.
 *
 * Le score n'est jamais affiche (section 3.1) : aucune valeur ni badge ici,
 * seule la position dans la liste (deja triee par le backend) le reflete.
 */
function ItineraryCard({ itinerary, isSelected, onSelect }: ItineraryCardProps) {
  const modes = modesUsedBy(itinerary);
  // Texte cache, lu par les lecteurs d'ecran : les icones de mode ci-dessous
  // sont `aria-hidden`, ce texte en est l'equivalent textuel (WCAG 1.1.1).
  const modesLabel = modes.map((mode) => getModeStyle(mode).label).join(', ');

  return (
    <button
      type="button"
      className={`resultats-card${isSelected ? ' is-selected' : ''}`}
      aria-current={isSelected || undefined}
      onClick={onSelect}
    >
      <span className="resultats-visually-hidden">Modes : {modesLabel}.</span>
      <span className="resultats-card-modes" aria-hidden="true">
        {modes.map((mode) => (
          <span key={mode} className="resultats-card-mode-icon">
            {getTripModeIcon(mode)}
          </span>
        ))}
      </span>
      <span className="resultats-card-main">
        <span className="resultats-card-time">
          {formatTime(itinerary.startTime)} → {formatTime(itinerary.endTime)}
        </span>
        <span className="resultats-card-duration">
          {formatDuration(itinerary.durationSeconds)}
        </span>
      </span>
      <span className="resultats-card-transfers">
        {formatTransfers(itinerary.transfers)}
      </span>
      <span className="resultats-card-action" aria-hidden="true">
        Voir le détail
      </span>
    </button>
  );
}

interface ItineraryDetailProps {
  itinerary: TripItinerary;
}

/**
 * Detail de l'itineraire selectionne (section 3.2/3.3 de la spec) : tracé
 * carte (MapView, #8) + decomposition segment par segment en texte (mode,
 * duree, arret de correspondance). La carte reste un complement visuel
 * (`aria-hidden`, voir MapView) - cette liste de segments est deja
 * l'alternative textuelle complete, comme l'exige la section 3.3.
 */
function ItineraryDetail({ itinerary }: ItineraryDetailProps) {
  return (
    <>
      <MapView itinerary={itinerary} />
      <ol
        className="resultats-segments"
        aria-label="Détail du trajet sélectionné, segment par segment"
      >
        {itinerary.segments.map((segment, index) => (
          <li key={index} className="resultats-segment">
            <span className="resultats-segment-icon" aria-hidden="true">
              {getTripModeIcon(segment.mode)}
            </span>
            <span className="resultats-segment-body">
              <span className="resultats-segment-label">
                {getModeStyle(segment.mode).label}
                {segment.routeName ? ` ${segment.routeName}` : ''}
              </span>
              <span className="resultats-segment-time">
                {formatTime(segment.startTime)} – {formatTime(segment.endTime)}{' '}
                ({formatDuration(segment.durationSeconds)})
              </span>
              <span className="resultats-segment-stop">
                {segment.from.name} → {segment.to.name}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </>
  );
}

/**
 * Ecran de resultats d'itineraires classes (F2, issue #36). Recoit les
 * itineraires deja recherches via l'etat de navigation pousse par
 * RecherchePage (#35) - une navigation directe sur /resultats (rechargement
 * de page, URL tapee a la main) n'a donc pas de criteres a afficher : on
 * renvoie alors vers /recherche plutot que d'afficher un ecran vide sans
 * contexte.
 *
 * Disposition mobile-first (section 3.3 de la spec) : sur mobile la liste
 * est visible en premier, la carte + le detail segment par segment sont
 * derriere une bascule "Voir sur la carte" ; a partir de 768px (voir
 * ResultatsPage.css), liste et carte sont affichees cote a cote en
 * permanence et la bascule disparait (elle n'a plus de role).
 *
 * Note de sequencement (section 3.4 de la spec) : cet ecran n'a aucune
 * dependance au service de scoring (#16, Sprint 3) - la liste est affichee
 * dans l'ordre renvoye par GET /trips, quel que soit le critere de tri
 * utilise cote backend a ce moment-la. Les badges qualitatifs decrits dans
 * docs/specs/f3-scoring-perturbations.md section 2.2 sont volontairement
 * reportes a l'implementation de #16, une fois un vrai scoring en place
 * (decision prise en session le 2026-08-03) : les afficher des maintenant,
 * sur un tri encore naïf (duree OTP native), serait trompeur.
 */
function ResultatsPage() {
  const location = useLocation();
  const state = location.state as ResultatsLocationState | null;

  // Itineraire selectionne par defaut : le premier de la liste (deja en tete
  // du tri backend). null tant qu'aucun resultat n'existe.
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Bascule liste/carte, pertinente seulement sur mobile (voir CSS) - la
  // carte + le detail restent toujours visibles a partir de 768px.
  const [isMapVisible, setIsMapVisible] = useState(false);

  if (!state) {
    return <Navigate to="/recherche" replace />;
  }

  const { itineraries, origin, destination } = state;
  const selectedItinerary = itineraries[selectedIndex] as
    | TripItinerary
    | undefined;

  return (
    <section className="resultats-page">
      <h1>Résultats</h1>
      <p className="resultats-context">
        De {origin.label} à {destination.label}
        {' — '}
        <Link to="/recherche">Modifier la recherche</Link>
      </p>

      {itineraries.length === 0 ? (
        // Etat vide (section 4 de la spec) : aucun itineraire trouve n'est
        // pas une erreur, pas d'Alert ici - un message clair et une action
        // de recours suffisent.
        <div className="resultats-empty">
          <p>Aucun itinéraire trouvé pour ce trajet.</p>
          <p>
            Essayez d'élargir la plage horaire ou d'ajouter un mode de
            transport a la recherche.
          </p>
          <Link to="/recherche">Nouvelle recherche</Link>
        </div>
      ) : (
        <div className="resultats-content">
          <div className="resultats-list-column">
            <ul className="resultats-list">
              {itineraries.map((itinerary, index) => (
                <li key={index}>
                  <ItineraryCard
                    itinerary={itinerary}
                    isSelected={index === selectedIndex}
                    onSelect={() => setSelectedIndex(index)}
                  />
                </li>
              ))}
            </ul>

            <button
              type="button"
              className="resultats-toggle-map"
              onClick={() => setIsMapVisible((visible) => !visible)}
              aria-expanded={isMapVisible}
            >
              {isMapVisible ? 'Voir la liste' : 'Voir sur la carte'}
            </button>
          </div>

          <div
            className={`resultats-map-wrapper${isMapVisible ? ' is-active' : ''}`}
          >
            {selectedItinerary && (
              <ItineraryDetail itinerary={selectedItinerary} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default ResultatsPage;
