import React from 'react';
import './GlassCard.css';

const GlassCard = ({ children, className = '', hover = true, glow = false, danger = false, onClick }) => {
  const classes = [
    'glass-card',
    hover ? 'glass-card--hover' : '',
    glow ? 'glass-card--glow' : '',
    danger ? 'glass-card--danger' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {children}
    </div>
  );
};

export default GlassCard;
