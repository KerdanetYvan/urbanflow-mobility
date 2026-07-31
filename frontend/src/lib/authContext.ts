import { createContext } from 'react';

export interface AuthContextValue {
  isAuthenticated: boolean;
  setAuthenticated: (value: boolean) => void;
}

// Fichier .ts (pas .tsx) sans composant : uniquement la definition du
// contexte, partagee par AuthProvider.tsx et useAuth.ts. La regle eslint
// react-refresh/only-export-components interdit qu'un fichier qui exporte un
// composant exporte aussi autre chose (contexte, hook...), d'ou cette
// separation en trois fichiers dedies.
export const AuthContext = createContext<AuthContextValue | undefined>(
  undefined,
);
