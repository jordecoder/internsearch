import { HashRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from '@/components/Navbar';
import { Dashboard } from '@/pages/Dashboard';
import { Tailor } from '@/pages/Tailor';

export default function App() {
  return (
    <HashRouter>
      <div className="min-h-screen bg-background">
        <Navbar />
        <Routes>
          <Route path="/"       element={<Dashboard />} />
          <Route path="/tailor" element={<Tailor />} />
        </Routes>
      </div>
    </HashRouter>
  );
}
