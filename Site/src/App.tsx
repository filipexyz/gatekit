import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Home } from './pages/public/Home';
import { Docs } from './pages/public/Docs';
import { About } from './pages/public/About';
import { Privacy } from './pages/public/Privacy';
import { Terms } from './pages/public/Terms';
import { AppShell } from './components/layout/AppShell';
import { Dashboard } from './pages/app/Dashboard';
import { Messages } from './pages/app/Messages';
import { Platforms } from './pages/app/Platforms';
import { ApiKeys } from './pages/app/ApiKeys';
import { Members } from './pages/app/Members';
import { Billing } from './pages/app/Billing';
import { Settings } from './pages/app/Settings';
import { Spinner } from './components/ui/Spinner';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/docs" element={<Docs />} />
      <Route path="/about" element={<About />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell>
              <Dashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/messages"
        element={
          <ProtectedRoute>
            <AppShell>
              <Messages />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/platforms"
        element={
          <ProtectedRoute>
            <AppShell>
              <Platforms />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/keys"
        element={
          <ProtectedRoute>
            <AppShell>
              <ApiKeys />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/members"
        element={
          <ProtectedRoute>
            <AppShell>
              <Members />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/billing"
        element={
          <ProtectedRoute>
            <AppShell>
              <Billing />
            </AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/app/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <Settings />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
