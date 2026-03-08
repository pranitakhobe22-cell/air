import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Wind, Network, MapPin, Shield, Heart,
  TrendingUp, User, Radiation, LogOut, WifiOff, Menu, X, RefreshCw, ServerOff, Clock
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import useAuthStore from '@/store/useAuthStore';
import useNodeStore from '@/store/useNodeStore';
import { logout } from '@/services/auth';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/live', label: 'Live Status', icon: Radio },
  { path: '/pollutants', label: 'Pollutants', icon: Wind },
  { path: '/network', label: 'Network', icon: Network },
  { path: '/map', label: 'Map', icon: MapPin },
  { path: '/exposure', label: 'Exposure', icon: Radiation },
  { path: '/health', label: 'Health', icon: Heart },
  { path: '/forecast', label: 'Forecast', icon: TrendingUp },
  { path: '/profile', label: 'Profile', icon: User },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const data = useAerisStore((s) => s.data);
  const loading = useAerisStore((s) => s.loading);
  const storeError = useAerisStore((s) => s.error);
  const isStale = useAerisStore((s) => s.isStale);
  const cachedAt = useAerisStore((s) => s.cachedAt);
  const fetchLatest = useAerisStore((s) => s.fetchLatest);
  const user = useAuthStore((s) => s.user);
  const selectedNode = useNodeStore((s) => s.selectedNode);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);
  const detectLocation = useNodeStore((s) => s.detectLocation);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Backend is unreachable AND no cached data at all
  const backendOffline = !loading && !data && !!storeError;

  // Update "time ago" every 30s for the stale banner
  useEffect(() => {
    if (!isStale) return;
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, [isStale]);

  const staleLabel = cachedAt ? (() => {
    const diffMin = Math.floor((now - cachedAt) / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  })() : null;

  const perNode = data?.perNode || {};
  const espNodeIds = Object.keys(perNode);

  useEffect(() => { detectLocation(); }, [detectLocation]);
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const rri = data?.derived?.rri || 0;
  const riskColor = data?.derived?.risk_color || '#10b981';

  return (
    <div className="min-h-screen bg-[#060910] text-slate-100 font-sans">

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#080d16]/90 backdrop-blur-2xl border-b border-white/[0.06] flex items-center justify-between px-4 z-[60]">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={20} />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-lg flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white tracking-tight">AERIS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
          <span className="text-sm font-bold tabular-nums" style={{ color: riskColor }}>{rri}</span>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-[70]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen w-[260px] bg-[#080d16]/95 backdrop-blur-2xl border-r border-white/[0.06] flex flex-col z-[80]
        transition-transform duration-300 ease-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>

        {/* Brand */}
        <div className="px-5 h-16 flex items-center justify-between shrink-0">
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-sky-400 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Shield className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <span className="text-[15px] font-bold tracking-tight text-white block leading-tight">AERIS</span>
              <span className="text-[10px] text-slate-500 font-medium tracking-wide">AIR INTELLIGENCE</span>
            </div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1.5 text-slate-500 hover:text-white transition-colors rounded-lg hover:bg-white/5">
            <X size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-sky-500/[0.12] text-sky-400 shadow-sm shadow-sky-500/10'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/[0.04]'
                }`
              }
            >
              <item.icon size={17} strokeWidth={isOnline ? 1.8 : 1.5} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Node Selector */}
        {espNodeIds.length > 0 && (
          <div className="px-4 py-3 mx-3 mb-2 bg-white/[0.03] rounded-xl">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider mb-2">Active Sensor</p>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="w-full h-9 px-3 bg-white/[0.05] rounded-lg text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-sky-500/40 cursor-pointer appearance-none border-0"
            >
              <option value="auto">Nearest (Auto)</option>
              <option value="all">All Stations</option>
              {espNodeIds.map((id) => (
                <option key={id} value={id}>{perNode[id]?.location || id}</option>
              ))}
            </select>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-rose-500'}`} />
              <span className="text-[11px] text-slate-600">{isOnline ? 'Connected' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-600 uppercase tracking-wide">RRI</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: riskColor }}>{rri}</span>
            </div>
          </div>

          {user && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03]">
              <NavLink to="/profile" className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-500 flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm shadow-sky-500/20">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-slate-200 truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-600 truncate">{user.email}</div>
                </div>
              </NavLink>
              <button
                onClick={() => { useAuthStore.getState().clearUser(); logout(); }}
                title="Log out"
                className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-[260px] min-h-screen pt-14 lg:pt-0">
        {/* Browser offline banner */}
        {!isOnline && !backendOffline && !isStale && (
          <div className="bg-rose-500/8 border-b border-rose-500/15 px-4 py-2.5 flex items-center justify-center gap-2">
            <WifiOff size={14} className="text-rose-400" />
            <span className="text-xs font-medium text-rose-400">You are offline. Showing last known data.</span>
          </div>
        )}

        {/* Stale cached data banner */}
        {isStale && (
          <div className="bg-amber-500/[0.06] px-4 py-2.5 flex items-center justify-center gap-3">
            <div className="flex items-center gap-2">
              <Clock size={13} className="text-amber-400" />
              <span className="text-xs font-medium text-amber-400">
                Server offline — showing cached data{staleLabel ? ` from ${staleLabel}` : ''}
              </span>
            </div>
            <button
              onClick={async () => {
                setRetrying(true);
                await fetchLatest();
                setRetrying(false);
              }}
              disabled={retrying}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[11px] font-semibold hover:bg-amber-500/15 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={11} className={retrying ? 'animate-spin' : ''} />
              <span>{retrying ? 'Retrying...' : 'Retry'}</span>
            </button>
          </div>
        )}

        {/* No data at all — full offline screen */}
        {backendOffline ? (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] lg:min-h-screen px-6 text-center">
            <div className="w-16 h-16 bg-white/[0.03] rounded-2xl flex items-center justify-center mb-6">
              <ServerOff size={28} className="text-slate-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Server Unreachable</h2>
            <p className="text-sm text-slate-500 max-w-sm mb-8 leading-relaxed">
              Unable to connect to the AERIS backend. The server may be starting up or temporarily unavailable.
            </p>
            <button
              onClick={async () => {
                setRetrying(true);
                await fetchLatest();
                setRetrying(false);
              }}
              disabled={retrying}
              className="flex items-center gap-2 px-6 py-3 bg-sky-500/10 text-sky-400 rounded-xl text-sm font-semibold hover:bg-sky-500/15 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={15} className={retrying ? 'animate-spin' : ''} />
              <span>{retrying ? 'Connecting...' : 'Retry Connection'}</span>
            </button>
            <p className="text-[11px] text-slate-600 mt-4">Auto-retry via WebSocket is active in the background.</p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
};

export default AppLayout;
