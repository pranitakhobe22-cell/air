import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import useAerisStore from '@/store/aerisStore';

// Layouts
import AppLayout from '@/components/AppLayout';

// Pages
import Landing from '@/pages/Landing';
import Dashboard from '@/pages/Dashboard';
import LiveStatus from '@/pages/LiveStatus';
import Pollutants from '@/pages/Pollutant';
import Network from '@/pages/Network';
import MapPage from '@/pages/MapPage';
import Exposure from '@/pages/Exposure';
import Health from '@/pages/Health';
import Forecast from '@/pages/Forecast';
import Profile from '@/pages/Profile';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';

function App() {
  const { fetchLatest } = useAerisStore();

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 8000);
    return () => clearInterval(interval);
  }, [fetchLatest]);

  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        {/* App Shell Routes (sidebar layout) */}
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/live" element={<LiveStatus />} />
          <Route path="/pollutants" element={<Pollutants />} />
          <Route path="/network" element={<Network />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/exposure" element={<Exposure />} />
          <Route path="/health" element={<Health />} />
          <Route path="/forecast" element={<Forecast />} />
          <Route path="/profile" element={<Profile />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
