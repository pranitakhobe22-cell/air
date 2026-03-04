import React from 'react';
import { RISK_COLORS } from '@/config/constants';
import './RiskBadge.css';

const RiskBadge = ({ level = 'safe', size = 'md' }) => {
  const color = RISK_COLORS[level] || RISK_COLORS.safe;
  const label = level ? level.charAt(0).toUpperCase() + level.slice(1) : 'Safe';

  return (
    <span
      className={`risk-badge risk-badge--${size}`}
      style={{
        color,
        backgroundColor: `${color}18`,
        borderColor: `${color}30`,
      }}
    >
      <span className="risk-badge__dot" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
};

export default RiskBadge;
