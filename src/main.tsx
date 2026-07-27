import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/base.css'
import './styles/shell.css'

document.documentElement.setAttribute(
  'data-theme',
  localStorage.getItem('qtm.theme') ?? 'light',
)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
