import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useAerisStore from '@/store/aerisStore';
import './AlertBanner.css';

const severityIcons = {
  critical: '🔴',
  warning: '🟠',
  info: '🔵',
};

const AlertBanner = ({ alert, onDismiss }) => {
  const { data } = useAerisStore();
  const aqi = data?.derived?.aqi || 0;

  const atmosphereMode = useMemo(() => {
    if (aqi <= 50) return 'clean';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'unhealthy';
    return 'hazard';
  }, [aqi]);

  if (!alert) return null;

  return (
    <AnimatePresence>
      <motion.div
        className={`alert-banner alert-banner--${alert.type} alert-banner--atmosphere-${atmosphereMode}`}
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        layout
      >
        <span className="alert-banner__icon">{severityIcons[alert.type] || '⚡'}</span>
        <div className="alert-banner__content">
          <span className="alert-banner__message">{alert.message}</span>
          <span className="alert-banner__time">
            {alert.timestamp ? new Date(alert.timestamp).toLocaleTimeString() : ''}
          </span>
        </div>
        {onDismiss && (
          <button className="alert-banner__dismiss" onClick={() => onDismiss(alert.id)}>
            ✕
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
};

export default AlertBanner;
