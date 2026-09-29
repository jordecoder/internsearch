import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/hooks/useAuth';
import { Dashboard } from '@/pages/Dashboard';
import { Saved } from '@/pages/Saved';
import { ApplyAgent } from '@/pages/ApplyAgent';
import { Interview } from '@/pages/Interview';
import { Board } from '@/pages/Board';
import { Login } from '@/pages/Login';
import { Settings } from '@/pages/Settings';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <AppShell>
            <Routes>
              <Route path="/"             element={<Dashboard />} />
              <Route path="/saved"        element={<Saved />} />
              <Route path="/apply"        element={<ApplyAgent />} />
              {/* Old links from before the apply agent replaced these two pages. */}
              <Route path="/tailor"       element={<Navigate to="/apply" replace />} />
              <Route path="/cover-letter" element={<Navigate to="/apply" replace />} />
              <Route path="/interview"    element={<Interview />} />
              <Route path="/board"        element={<Board />} />
              <Route path="/login"        element={<Login />} />
              <Route path="/settings"     element={<Settings />} />
            </Routes>
          </AppShell>
        </AuthProvider>
      </HashRouter>
    </QueryClientProvider>
  );
}
