import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ThemeProvider } from './theme'
import './styles/tokens.css'
import './styles/global.css'
import './styles/app.css'
import './styles/library.css'
import './styles/player.css'
import './styles/classify.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>,
)
