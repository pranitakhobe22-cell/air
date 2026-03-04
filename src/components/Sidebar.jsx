import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAppStore, useAerisStore } from '@/store';
import LiveIndicator from './shared/LiveIndicator';
import './Sidebar.css';

const navItems = [
  { path: '/',          label: 'Dashboard',    icon: '📊' },
  { path: '/live',      label: 'Live Status',  icon: '🔴' },
  { path: '/map',       label: 'Sector Map',   icon: '🗺️' },
  { path: '/exposure',  label: 'Exposure',     icon: '🫁' },
  { path: '/forecast',  label: 'Forecast',     icon: '📈' },
  { path: '/health',    label: 'Health',        icon: '💚' },
  { path: '/pollutant', label: 'Pollutants',   icon: '🧪' },
  { path: '/network',   label: 'Network',       icon: '📡' },
  { path: '/profile',   label: 'Profile',       icon: '👤' },
];

const Sidebar = () => {
  const { sidebarCollapsed, toggleSidebar } = useAppStore();
  const { dataSource, derived } = useAerisStore();

  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'sidebar--collapsed' : ''}`}>
      {/* Brand */}
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <span className="logo-icon">🌿</span>
          {!sidebarCollapsed && (
            <div className="logo-text">
              <span className="logo-name">AERIS</span>
              <span className="logo-sub">Intelligence</span>
            </div>
          )}
        </div>
        <button className="sidebar__toggle" onClick={toggleSidebar}>
          {sidebarCollapsed ? '▶' : '◀'}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
            }
            title={item.label}
          >
            <span className="sidebar__link-icon">{item.icon}</span>
            {!sidebarCollapsed && <span className="sidebar__link-label">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar__footer">
        <LiveIndicator active={dataSource !== 'offline'} />
        {!sidebarCollapsed && (
          <div className="sidebar__status">
            <span className="sidebar__status-label">
              {dataSource === 'simulator' ? 'SIM MODE' : 'LIVE API'}
            </span>
            <span className="sidebar__rri">
              RRI: <strong style={{ color: derived.risk_color }}>{derived.rri}</strong>
            </span>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
