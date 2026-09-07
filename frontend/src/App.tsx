import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { AuthProvider } from '@/hooks/useAuth';
import { Dashboard } from '@/pages/Dashboard';
import { Tailor } from '@/pages/Tailor';
import { CoverLetter } from '@/pages/CoverLetter';
import { Interview } from '@/pages/Interview';
import { Board } from '@/pages/Board';
import { Login } from '@/pages/Login';

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Navbar />
          <Routes>
            <Route path="/"             element={<Dashboard />} />
            <Route path="/tailor"       element={<Tailor />} />
            <Route path="/cover-letter" element={<CoverLetter />} />
            <Route path="/interview"    element={<Interview />} />
            <Route path="/board"        element={<Board />} />
            <Route path="/login"        element={<Login />} />
          </Routes>
        </div>
      </AuthProvider>
    </HashRouter>
  );
}
