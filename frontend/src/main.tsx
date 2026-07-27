import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// BrowserRouter est place ici (point d'entree reel de l'app) plutot que dans
// App.tsx, pour que App.tsx puisse etre teste avec un MemoryRouter a la
// place (voir App.spec.tsx) sans conflit entre deux routeurs imbriques.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
