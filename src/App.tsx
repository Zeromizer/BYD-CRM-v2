import { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { AuthPage, AuthGuard } from '@/components/Auth';
import { Layout } from '@/components/Layout';
import { ToastProvider, ErrorBoundary } from '@/components/common';
import { ThemeProvider } from '@/context/ThemeContext';
import './styles/globals.css';

// Lazy load heavy route components for code splitting
const Dashboard = lazy(() => import('@/components/Dashboard').then(m => ({ default: m.Dashboard })));
const DocumentsPage = lazy(() => import('@/components/Documents').then(m => ({ default: m.DocumentsPage })));
const ExcelPage = lazy(() => import('@/components/Excel').then(m => ({ default: m.ExcelPage })));

// Loading fallback for lazy-loaded routes
function RouteLoadingFallback() {
  return (
    <div className="route-loading">
      <div className="loading-spinner" />
      <p>Loading...</p>
    </div>
  );
}

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
    <ErrorBoundary>
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
                <Route index element={<Suspense fallback={<RouteLoadingFallback />}><Dashboard /></Suspense>} />
                <Route path="customers" element={<Suspense fallback={<RouteLoadingFallback />}><Dashboard /></Suspense>} />
                <Route path="customers/:customerId" element={<Suspense fallback={<RouteLoadingFallback />}><Dashboard /></Suspense>} />
                <Route path="documents" element={<Suspense fallback={<RouteLoadingFallback />}><DocumentsPage /></Suspense>} />
                <Route path="excel" element={<Suspense fallback={<RouteLoadingFallback />}><ExcelPage /></Suspense>} />
              </Route>

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
