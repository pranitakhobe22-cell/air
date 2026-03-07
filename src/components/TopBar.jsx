import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAerisStore, useAppStore } from '@/store';
import useAuthStore from '@/store/useAuthStore';
import './TopBar.css';

const TopBar = () => {
  const navigate = useNavigate();
  const { meta, alerts, derived } = useAerisStore();
  const { currentLocationId, setCurrentLocationId } = useAppStore();
  const sectors = useAerisStore((s) => s.sectors);
  const user = useAuthStore((s) => s.user);

  const userInitial = user?.name ? user.name[0].toUpperCase() : 'U';

  const formatTime = (iso) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <header className="topbar">
      <div className="topbar__left">
        <div className="topbar__breadcrumb">
          <span className="topbar__page-title">Environmental Risk Intelligence</span>
        </div>
      </div>

      <div className="topbar__right">
        {/* Last Updated */}
        <div className="topbar__timestamp">
          <span className="topbar__timestamp-label">LAST SYNC</span>
          <span className="topbar__timestamp-value">{formatTime(meta.timestamp)}</span>
        </div>

        {/* Location Picker */}
        <div className="topbar__location">
          <span className="topbar__location-icon">📍</span>
          <select
            value={currentLocationId}
            onChange={(e) => setCurrentLocationId(e.target.value)}
            className="topbar__location-select"
          >
            {sectors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {/* Notifications */}
        <button className="topbar__notifications">
          <span>🔔</span>
          {alerts.length > 0 && (
            <span className="topbar__badge">{alerts.length}</span>
          )}
        </button>

        {/* Profile Avatar — shows real user initial */}
        <button
          onClick={() => navigate('/profile')}
          className="topbar__avatar"
          title={user?.name || 'Profile'}
        >
          <div className="topbar__avatar-img" style={{ background: `linear-gradient(135deg, #38bdf8, #2563eb)` }}>
            {userInitial}
          </div>
        </button>
      </div>
    </header>
  );
};

export default TopBar;

