
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { ClerkProvider } from '@clerk/clerk-react'
import { BrowserRouter } from "react-router"

const publishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

const RootApp = (
  <StrictMode>
    {publishableKey ? (
      <ClerkProvider publishableKey={publishableKey}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ClerkProvider>
    ) : (
      <App />
    )}
  </StrictMode>
)

createRoot(document.getElementById('root')).render(RootApp)
