import { HistoryIcon } from '../../components/icons';
import './HistoriquePage.css';

/**
 * Ecran d'historique des trajets recents (F2, stretch).
 *
 * Contenu reel a implementer par l'issue dediee "F2 - Historique des
 * trajets recents" (backlog Stretch) - hors perimetre de l'issue #73
 * (docs/specs/refonte-visuelle-mobile-desktop.md section 5.3), qui ne
 * cadre qu'un habillage minimal de coherence visuelle pour ce placeholder,
 * pas sa vraie disposition (encore inconnue).
 */
function HistoriquePage() {
  return (
    <section className="historique-page">
      <h1>Historique</h1>
      <div className="historique-empty">
        <span className="historique-empty-icon" aria-hidden="true">
          <HistoryIcon />
        </span>
        <p>L'historique des trajets récents sera affiché ici.</p>
      </div>
    </section>
  );
}

export default HistoriquePage;
