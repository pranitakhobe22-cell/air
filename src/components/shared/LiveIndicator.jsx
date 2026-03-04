import React from 'react';
import './LiveIndicator.css';

const LiveIndicator = ({ label = 'LIVE', active = true }) => {
  return (
    <div className={`live-indicator ${active ? 'live-indicator--active' : ''}`}>
      <div className="live-indicator__dot">
        <div className="live-indicator__ring" />
      </div>
      <span className="live-indicator__label">{label}</span>
    </div>
  );
};

export default LiveIndicator;
