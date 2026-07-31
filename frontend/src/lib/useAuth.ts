import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from './authContext';
// (AuthContext vit dans authContext.ts, AuthProvider dans AuthProvider.tsx :
// voir le commentaire de authContext.ts pour la raison de ce decoupage.)

/** Acces au contexte d'authentification. A utiliser uniquement sous AuthProvider (voir App.tsx). */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth doit etre utilise a l'interieur de <AuthProvider>");
  }
  return context;
}
