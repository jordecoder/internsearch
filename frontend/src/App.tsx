import { HashRouter, Routes, Route } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { AppShell } from '@/components/layout/AppShell';
import { AuthProvider } from '@/hooks/useAuth';
import { Dashboard } from '@/pages/Dashboard';
import { Saved } from '@/pages/Saved';
import { Tailor } from '@/pages/Tailor';
import { CoverLetter } from '@/pages/CoverLetter';
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
              <Route path="/tailor"       element={<Tailor />} />
              <Route path="/cover-letter" element={<CoverLetter />} />
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
