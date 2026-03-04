import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, Radio, Wind, Network, MapPin, Shield, Heart, 
  TrendingUp, User, Radiation
} from 'lucide-react';
import useAerisStore from '@/store/aerisStore';
import { getAtmosphereTheme } from '@/utils/atmosphereTheme';
import './AppLayout.css';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/live', label: 'Live Status', icon: Radio },
  { path: '/pollutants', label: 'Pollutants', icon: Wind },
  { path: '/network', label: 'Network', icon: Network },
  { path: '/map', label: 'Hyperlocal Map', icon: MapPin },
  { path: '/exposure', label: 'Exposure', icon: Radiation },
  { path: '/health', label: 'Health', icon: Heart },
  { path: '/forecast', label: 'Forecast', icon: TrendingUp },
  { path: '/profile', label: 'Profile', icon: User },
];

const AppLayout = () => {
  const navigate = useNavigate();
  const { data } = useAerisStore();
  
  // Intelligence Extraction
  const aqi = data?.derived?.aqi || 0;
  const riskLevel = data?.derived?.risk_level || 'Low Risk';
  const rri = data?.derived?.rri || 0;
  const riskColor = data?.derived?.risk_color || '#10b981';

  // Atmospheric Theme Engine
  const [currentTheme, setCurrentTheme] = useState(getAtmosphereTheme(aqi, riskLevel));

  useEffect(() => {
    const theme = getAtmosphereTheme(aqi, riskLevel);
    setCurrentTheme(theme);
    
    // Synchronize global background with theme
    document.body.style.background = theme.backgroundGradient;
    document.body.style.transition = 'background 0.8s ease';
    
    // Inject Theme Variables for Glass System
    document.documentElement.style.setProperty('--glass-bg', theme.cardBackground);
    document.documentElement.style.setProperty('--text-main', theme.textPrimary);
    document.documentElement.style.setProperty('--text-muted', theme.textSecondary);
    document.documentElement.style.setProperty('--accent-glow', theme.glowColor);
    
    // Inject Air Density Variables
    document.documentElement.style.setProperty('--layout-gap', theme.sectionSpacing);
    document.documentElement.style.setProperty('--glass-shadow', theme.cardShadow);
    
    // Smooth transitions
    document.body.style.color = theme.textPrimary;
    document.body.style.transition = 'background 0.8s ease, color 0.5s ease';

    const rootElement = document.getElementById('root');
    if (rootElement) {
      rootElement.style.background = theme.backgroundGradient;
      rootElement.style.transition = 'background 0.8s ease';
    }
    
    // System Preparation: Log active theme mode
    if (import.meta.env.DEV) {
      console.log(`🌌 [AtmosphereEngine] Mode: ${theme.mode.toUpperCase()} (AQI: ${aqi})`);
    }
  }, [aqi, riskLevel]);

  return (
    <div 
      className="min-h-screen text-slate-100 font-sans flex relative overflow-hidden"
      style={{ 
        background: currentTheme.backgroundGradient,
        transition: 'background 0.8s ease'
      }}
    >
      {/* 🌌 Atmospheric Haze Layer */}
      <div 
        className="atmosphere-haze"
        style={{ 
          background: currentTheme.hazeOverlay,
          opacity: currentTheme.mode === 'unhealthy' ? 0.25 : (currentTheme.mode === 'hazard' ? 0.09 : 0.12)
        }}
      />
      
      {/* ── Atmospheric Vignette (Hazard Only) ─────────────── */}
      {currentTheme.mode === 'hazard' && <div className="atmosphere-vignette" />}

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="sidebar-container">
        <aside className="w-72 fixed top-0 left-0 h-screen bg-[#111827] border-r border-white/5 flex flex-col z-50">
          {/* Brand */}
          <div className="p-6 flex items-center space-x-3 border-b border-white/5">
            <div className="w-9 h-9 bg-linear-to-br from-sky-400 to-blue-600 rounded-xl flex items-center justify-center shadow-lg cursor-pointer" onClick={() => navigate('/')}>
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight bg-linear-to-r from-white to-slate-400 bg-clip-text text-transparent">AERIS</div>
              <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.2em]">Intelligence</div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
            {navItems.map(item => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${isActive 
                    ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-[0_0_12px_rgba(34,211,238,0.05)]' 
                    : 'text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-transparent'}
                `}
              >
                <item.icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Live Uplink</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: riskColor }}>RRI</span>
                <span className="text-sm font-black" style={{ color: riskColor }}>{rri}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Main Content ─────────────────────────────────────── */}
      <main className="ml-72 flex-1 min-h-screen app-shell-content">
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
