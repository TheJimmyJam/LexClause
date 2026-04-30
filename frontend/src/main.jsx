import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:                  1000 * 10,
      refetchInterval:            1000 * 15,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus:       true,
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
          <Toaster position="top-right" toastOptions={{
            style: { background: '#0f172a', color: '#f1f5f9', borderRadius: '8px', border: '1px solid rgba(20,184,166,0.3)' },
            success: { iconTheme: { primary: '#14b8a6', secondary: '#fff' } },
          }} />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
