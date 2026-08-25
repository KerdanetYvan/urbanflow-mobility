import './Skeleton.css';

interface SkeletonProps {
  /** Nombre de blocs a afficher empiles (ex. 3 pour simuler une liste de 3 cartes). */
  count?: number;
  /** Hauteur d'un bloc, en rem (defaut 4.5rem, taille d'une carte-itineraire). */
  heightRem?: number;
}

/**
 * Squelette de chargement generique (issue #162, extrait de ResultsSkeleton
 * de RecherchePageResults.tsx, issue #73 spec 2.4) : bloc(s) anime(s) en
 * pulsation, a afficher a la place d'un contenu pas encore charge. Reutilise
 * partout ou l'app affiche un etat de chargement (Recherche, Profil,
 * Historique) plutot que le simple texte "Chargement…" utilise auparavant
 * sur Profil/Historique - un seul vocabulaire visuel pour la meme idee dans
 * toute l'app.
 *
 * Respecte prefers-reduced-motion (voir Skeleton.css), comme l'anneau de
 * position temps reel de MapView.css.
 */
function Skeleton({ count = 1, heightRem = 4.5 }: SkeletonProps) {
  return (
    <div className="skeleton" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="skeleton-block"
          style={{ height: `${heightRem}rem` }}
        />
      ))}
    </div>
  );
}

export default Skeleton;
