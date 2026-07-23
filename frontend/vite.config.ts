import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// On importe defineConfig depuis 'vitest/config' plutot que 'vite' : c'est le
// meme objet de configuration Vite, mais avec en plus le typage de la cle
// "test" (sinon TypeScript ne connaitrait pas les options Vitest ci-dessous).
// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Simule un DOM navigateur (document, window...) necessaire pour
    // React Testing Library, puisque les tests tournent dans Node.js.
    environment: 'jsdom',
    // Fichier execute avant chaque fichier de test : ajoute les matchers
    // supplementaires de jest-dom (toBeInTheDocument(), etc.).
    setupFiles: './src/test/setup.ts',
    // Autorise describe/it/expect sans les importer explicitement dans
    // chaque fichier de test (comme le fait Jest cote backend).
    globals: true,
  },
})
