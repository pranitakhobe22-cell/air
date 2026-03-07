import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Radio, Wind, Network, MapPin, Shield, Heart,
  TrendingUp, User, Radiation, LogOut, WifiOff, Menu, X
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
  const user = useAuthStore((s) => s.user);
  const selectedNode = useNodeStore((s) => s.selectedNode);
  const setSelectedNode = useNodeStore((s) => s.setSelectedNode);
  const detectLocation = useNodeStore((s) => s.detectLocation);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const perNode = data?.perNode || {};
  const espNodeIds = Object.keys(perNode);

  useEffect(() => { detectLocation(); }, [detectLocation]);

  // Close sidebar on route change (mobile)
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
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 font-sans">

      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-[#0f1420]/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between px-4 z-[60]">
        <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors">
          <Menu size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center">
            <Shield className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">AERIS</span>
        </div>
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <span className="text-sm font-bold tabular-nums" style={{ color: riskColor }}>{rri}</span>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-screen w-64 bg-[#0f1420] border-r border-slate-800 flex flex-col z-[80]
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>

        {/* Brand */}
        <div className="px-5 py-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 bg-gradient-to-br from-sky-400 to-blue-600 rounded-lg flex items-center justify-center cursor-pointer shrink-0"
              onClick={() => navigate('/')}
            >
              <Shield className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight text-white">AERIS</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden p-1 text-slate-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-3 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-500/10 text-sky-400'
                    : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
                }`
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Node Selector */}
        {espNodeIds.length > 0 && (
          <div className="px-3 py-3 border-t border-slate-800">
            <p className="text-[10px] font-semibold text-slate-600 uppercase tracking-wider px-1 mb-2">Sensor Node</p>
            <select
              value={selectedNode}
              onChange={(e) => setSelectedNode(e.target.value)}
              className="w-full h-9 px-3 bg-slate-800/60 border border-slate-700/40 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-sky-500/50 cursor-pointer appearance-none"
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
        <div className="p-4 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-[11px] text-slate-600">{isOnline ? 'Connected' : 'Offline'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-slate-500">RRI</span>
              <span className="text-sm font-bold tabular-nums" style={{ color: riskColor }}>{rri}</span>
            </div>
          </div>

          {user && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40">
              <NavLink to="/profile" className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-slate-200 truncate">{user.name}</div>
                  <div className="text-[11px] text-slate-600 truncate">{user.email}</div>
                </div>
              </NavLink>
              <button
                onClick={() => { useAuthStore.getState().clearUser(); logout(); }}
                title="Log out"
                className="p-1.5 rounded-md text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors shrink-0"
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen pt-14 lg:pt-0">
        {!isOnline && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-center gap-2">
            <WifiOff size={14} className="text-rose-400" />
            <span className="text-xs font-medium text-rose-400">You are offline. Showing last known data.</span>
          </div>
        )}
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
