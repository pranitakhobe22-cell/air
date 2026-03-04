import React, { useMemo, useEffect, useState } from 'react';
import { motion, useSpring, useTransform, animate } from 'framer-motion';
import { RISK_THRESHOLDS } from '@/config/constants';
import useAerisStore from '@/store/aerisStore';
import './RRIMeter.css';

const RRIMeter = ({ value = 0, status = 'Safe', trend = 'stable' }) => {
  const { data } = useAerisStore();
  const aqi = data?.derived?.aqi || 0;
  
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Adaptive Atmospheric Mode derivation
  const atmosphereMode = useMemo(() => {
    if (aqi <= 50) return 'clean';
    if (aqi <= 100) return 'moderate';
    if (aqi <= 150) return 'unhealthy';
    return 'hazard';
  }, [aqi]);

  const riskColor = useMemo(() => {
    for (const tier of Object.values(RISK_THRESHOLDS)) {
      if (clampedValue >= tier.min && clampedValue <= tier.max) return tier.color;
    }
    return '#2ECCB0';
  }, [clampedValue]);

  // Count-up Animation for RRI Number
  const [displayValue, setDisplayValue] = useState(0);
  useEffect(() => {
    const controls = animate(displayValue, clampedValue, {
      duration: 1.5,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayValue(Math.round(latest))
    });
    return () => controls.stop();
  }, [clampedValue]);

  // SVG arc calculations
  const radius = 80;
  const strokeWidth = 10;
  const center = 100;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240 degrees
  const progressAngle = startAngle + (clampedValue / 100) * totalAngle;

  const polarToCartesian = (angle) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: center + radius * Math.cos(rad),
      y: center + radius * Math.sin(rad),
    };
  };

  const describeArc = (start, end) => {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArcFlag = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${e.x} ${e.y}`;
  };

  const bgPath = describeArc(startAngle, endAngle);
  const valuePath = clampedValue > 0 ? describeArc(startAngle, progressAngle) : '';

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <div className={`rri-meter rri-meter--${atmosphereMode}`}>
      <svg viewBox="0 0 200 160" className="rri-meter__svg">
        <defs>
          <filter id="rri-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="inner-shadow">
            <feOffset dx="0" dy="2" />
            <feGaussianBlur stdDeviation="3" result="offset-blur" />
            <feComposite operator="out" in="SourceGraphic" in2="offset-blur" result="inverse" />
            <feFlood floodColor="black" floodOpacity="0.4" result="color" />
            <feComposite operator="in" in="color" in2="inverse" result="shadow" />
            <feComposite operator="over" in="shadow" in2="SourceGraphic" />
          </filter>
        </defs>

        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />

        {/* Value arc */}
        {valuePath && (
          <motion.path
            d={valuePath}
            fill="none"
            stroke={riskColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            filter="url(#rri-glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
            className="rri-meter__arc"
          />
        )}

        {/* Center value */}
        <text 
          x={center} 
          y={center - 10} 
          textAnchor="middle" 
          className="rri-meter__number" 
          fill={riskColor}
          filter={atmosphereMode === 'hazard' ? 'url(#inner-shadow)' : ''}
        >
          {displayValue}
        </text>
        <text x={center} y={center + 12} textAnchor="middle" className="rri-meter__label" fill="var(--text-muted)">
          RRI
        </text>
        <text x={center} y={center + 30} textAnchor="middle" className="rri-meter__status" fill={riskColor}>
          {status}
        </text>
      </svg>

      {/* Breathing glow ring (Halo) */}
      <div className="rri-meter__glow" style={{ borderColor: riskColor }} />

      {/* Trend indicator */}
      <div className={`rri-meter__trend rri-meter__trend--${trend}`}>
        {trendIcon}
      </div>
    </div>
  );
};

export default RRIMeter;
