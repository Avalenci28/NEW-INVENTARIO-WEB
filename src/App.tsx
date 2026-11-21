import React, {Suspense, lazy, useEffect, useState} from 'react';
import {BrowserRouter, Navigate, Route, Routes} from 'react-router-dom';
import {WifiOff} from 'lucide-react';
import {ErrorBoundary} from './components/ErrorBoundary';
import {PushNotificationMonitor} from './components/PushNotificationMonitor';
import {AuthProvider, useAuth} from './context/AuthContext';
import {InventoryProvider} from './context/InventoryContext';
import {ToastProvider} from './context/ToastContext';
import {AlertsPage} from './pages/AlertsPage';
import {AssistantPage} from './pages/AssistantPage';
import {HomePage} from './pages/HomePage';
import {LegalPage} from './pages/LegalPage';
import {LoginPage} from './pages/LoginPage';
import {NewProductPage} from './pages/NewProductPage';
import {RegisterPage} from './pages/RegisterPage';
import {SpaceDetailPage} from './pages/SpaceDetailPage';
import {SpacesPage} from './pages/SpacesPage';
import {WelcomePage} from './pages/WelcomePage';

const ScanPage = lazy(() =>
  import('./pages/ScanPage').then((mod) => ({default: mod.ScanPage})),
);

function ProtectedRoute({children}: {children: React.ReactNode}) {
  const {user, loading} = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#0A1F32] text-white">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-[#1F69FC]" />
          <p className="mt-3 text-xs font-medium text-slate-300">Cargando tu inventario...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div className="fixed top-2 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#0A1F32] px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg safe-top">
      <WifiOff className="h-3.5 w-3.5 text-[#EF8D2A]" />
      <span>Sin conexión · Mostrando datos guardados</span>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <InventoryProvider>
            <PushNotificationMonitor />
            <OfflineBanner />
            <BrowserRouter>
              <Suspense
                fallback={
                  <div className="flex min-h-[100dvh] items-center justify-center bg-[#0A1F32] text-white">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-[#EF8D2A]" />
                  </div>
                }
              >
                <Routes>
                  <Route path="/" element={<WelcomePage />} />
                  <Route path="/registro" element={<RegisterPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/privacidad" element={<LegalPage mode="privacidad" />} />
                  <Route path="/terminos" element={<LegalPage mode="terminos" />} />

                  <Route
                    path="/inicio"
                    element={
                      <ProtectedRoute>
                        <HomePage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/espacios"
                    element={
                      <ProtectedRoute>
                        <SpacesPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/espacios/:id"
                    element={
                      <ProtectedRoute>
                        <SpaceDetailPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/escanear"
                    element={
                      <ProtectedRoute>
                        <ScanPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/prendas/nueva"
                    element={
                      <ProtectedRoute>
                        <NewProductPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/alertas"
                    element={
                      <ProtectedRoute>
                        <AlertsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/asistente"
                    element={
                      <ProtectedRoute>
                        <AssistantPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </InventoryProvider>
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
