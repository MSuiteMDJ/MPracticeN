import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/auth';
import { SettingsProvider } from '@/contexts/SettingsContext';
import LoadingScreen from '@/components/LoadingScreen';
import Login from '@/components/auth/Login';
import Register from '@/components/Register';
import ForgotPassword from '@/components/ForgotPassword';
import Dashboard from '@/components/Dashboard';
import Services from '@/components/Services';
import Onboarding from '@/components/Onboarding';
import ComplianceRevamped from '@/components/ComplianceRevamped';
import Clients from '@/components/Clients';
import ClientDetail from '@/components/ClientDetail';
import CompaniesHouseSearch from '@/components/CompaniesHouseSearch';
import CompaniesHouseProfile from '@/components/CompaniesHouseProfile';
import Contacts from '@/components/Contacts';
import Documents from '@/components/Documents';
import Reports from '@/components/Reports';
import Settings from '@/components/SettingsRedesigned';
import KnowledgeCentre from '@/components/KnowledgeCentre';
import Checklist from '@/components/knowledge/Checklist';
import Tutorials from '@/components/knowledge/Tutorials';
import Templates from '@/components/knowledge/Templates';
import HMRCResources from '@/components/knowledge/HMRCResources';
import AssistPanel from '@/components/assist/AssistPanel';
import { ShellLayout } from '@/components/layout/AppShellLayout';
import DocumentTemplates from '@/components/DocumentTemplates';
import DemoModeIndicator from '@/components/DemoModeIndicator';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function HomeRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? '/dashboard' : '/login'} replace />;
}

function AppContent() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/forgot-password"
        element={
          <PublicRoute>
            <ForgotPassword />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Dashboard />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/services"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Services />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/claims" element={<Navigate to="/services" replace />} />
      <Route path="/manifest" element={<Navigate to="/services" replace />} />
      <Route path="/analysis" element={<Navigate to="/services" replace />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Onboarding />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/compliance"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <ComplianceRevamped />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Clients />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <ClientDetail />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:id/edit"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <ClientDetail />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies-house"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <CompaniesHouseSearch />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/companies-house/:companyNumber"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <CompaniesHouseProfile />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/contacts"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Contacts />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Documents />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Settings />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <KnowledgeCentre />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Reports />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/documents/templates"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <DocumentTemplates />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/knowledge/guide" element={<Navigate to="/knowledge" replace />} />
      <Route
        path="/knowledge/checklist"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Checklist />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge/tutorials"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Tutorials />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge/videos"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Tutorials />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge/templates"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <Templates />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/knowledge/hmrc"
        element={
          <ProtectedRoute>
            <ShellLayout>
              <HMRCResources />
              <AssistPanel />
            </ShellLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<HomeRedirect />} />
      <Route path="*" element={<HomeRedirect />} />
    </Routes>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);

  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  return (
    <SettingsProvider>
      <AuthProvider>
        <DemoModeIndicator />
        <AppContent />
      </AuthProvider>
    </SettingsProvider>
  );
}
