import React from 'react';
import { motion } from 'framer-motion';
import './SensorCard.css';

const trendIcons = {
  up: '↑',
  down: '↓',
  stable: '→',
};

const trendLabels = {
  up: 'Rising',
  down: 'Falling',
  stable: 'Stable',
};

const SensorCard = ({ label, value, unit, trend = 'stable', icon, color = 'blue', safe }) => {
  const isAboveSafe = safe && value > safe;

  return (
    <div className={`sensor-card ${isAboveSafe ? 'sensor-card--warning' : ''}`}>
      <div className="sensor-card__header">
        <div className={`sensor-card__icon sensor-card__icon--${color}`}>
          {icon}
        </div>
        <div className={`sensor-card__trend sensor-card__trend--${trend}`}>
          <span className="trend-icon">{trendIcons[trend]}</span>
          <span className="trend-label">{trendLabels[trend]}</span>
        </div>
      </div>
      <div className="sensor-card__value-container">
        <motion.span
          className="sensor-card__value"
          key={value}
          initial={{ opacity: 0.5, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {value != null ? value : '--'}
        </motion.span>
        <span className="sensor-card__unit">{unit}</span>
      </div>
      <div className="sensor-card__label">{label}</div>
      {isAboveSafe && (
        <div className="sensor-card__warning-bar" />
      )}
    </div>
  );
};

export default SensorCard;
