import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthPage, AuthGuard } from '@/components/Auth';
import { Layout } from '@/components/Layout';
import { Dashboard } from '@/components/Dashboard';
import { DocumentsPage } from '@/components/Documents';
import { ExcelPage } from '@/components/Excel';
import { ToastProvider } from '@/components/common';
import { ThemeProvider } from '@/context/ThemeContext';
import './styles/globals.css';

function App() {
  const { initialize, isInitialized } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (!isInitialized) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter basename="/BYD-CRM-v2">
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<AuthPage />} />

            {/* Protected routes */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <Layout />
                </AuthGuard>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="customers" element={<Dashboard />} />
              <Route path="customers/:customerId" element={<Dashboard />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="excel" element={<ExcelPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;
