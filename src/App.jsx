import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import React, { useEffect, Suspense, lazy } from 'react';
import useAerisStore from '@/store/aerisStore';
import useAuthStore from '@/store/useAuthStore';
import ProtectedRoute from '@/components/ProtectedRoute';
import useLiveData from '@/hooks/useLiveData';

// Layouts
import AppLayout from '@/components/AppLayout';

// Eagerly loaded (critical path)
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Signup from '@/pages/Signup';

// Lazy loaded (code-split for performance)
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const LiveStatus = lazy(() => import('@/pages/LiveStatus'));
const Pollutants = lazy(() => import('@/pages/Pollutant'));
const Network = lazy(() => import('@/pages/Network'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const Exposure = lazy(() => import('@/pages/Exposure'));
const Health = lazy(() => import('@/pages/Health'));
const Forecast = lazy(() => import('@/pages/Forecast'));
const Profile = lazy(() => import('@/pages/Profile'));
const Onboarding = lazy(() => import('@/pages/Onboarding'));

const PageLoader = () => (
  <div className="min-h-screen bg-[#0B0F1A] flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-sky-500/30 border-t-sky-500 rounded-full animate-spin" />
  </div>
);

// Error Boundary to catch React crashes instead of showing black screen
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[AERIS] React crash:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: '100vh', background: '#0B0F1A', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#f1f5f9', fontFamily: 'sans-serif', padding: '2rem', textAlign: 'center' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '1rem' }}>AERIS System Error</h2>
          <p style={{ color: '#ef4444', fontSize: '0.875rem', maxWidth: '600px', wordBreak: 'break-word' }}>
            {this.state.error?.message || 'Unknown error'}
          </p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '1.5rem', padding: '0.75rem 2rem', background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '9999px', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppInner() {
  // Mount the global real-time data listener (WebSocket + Simulator fallback)
  useLiveData();

  useEffect(() => {
    useAuthStore.getState().fetchMe();
    useAerisStore.getState().fetchLatest();
  }, []);

  return (
    <div style={{ minHeight: '100vh' }}>
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/onboarding" element={<Onboarding />} />

          {/* Protected App Shell Routes */}
          <Route element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }>
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
      </Suspense>
    </Router>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <AppInner />
    </ErrorBoundary>
  );
}

export default App;
