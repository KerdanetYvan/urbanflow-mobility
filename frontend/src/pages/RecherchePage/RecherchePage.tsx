import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/useAuth';
import './RecherchePage.css';

/**
 * Ecran de recherche d'itineraire (F2) - aussi la page d'accueil de
 * l'application ("/" redirige ici, voir App.tsx).
 *
 * Utilisable sans compte (issue #64) : un usager de passage doit pouvoir
 * lancer une recherche sans etre bloque par un mur de connexion. Un
 * utilisateur non identifie voit simplement une invitation discrete a se
 * connecter (pour retrouver son profil de mobilite et ses preferences),
 * jamais un ecran de connexion force.
 *
 * Contenu reel (formulaire origine/destination, appel a l'API de recherche)
 * a implementer par l'issue dediee "Dev FE - Ecran de recherche
 * d'itineraire" (#35, Sprint 2). Placeholder pour l'instant.
 */
function RecherchePage() {
  const { isAuthenticated } = useAuth();

  return (
    <section>
      <h1>Recherche d'itinéraire</h1>
      <p>Le formulaire de recherche multimodale sera ajouté ici.</p>

      {!isAuthenticated && (
        <p className="recherche-guest-hint">
          <Link to="/connexion">Connectez-vous</Link> pour retrouver votre
          profil de mobilité et des trajets personnalisés.
        </p>
      )}
    </section>
  );
}

export default RecherchePage;
