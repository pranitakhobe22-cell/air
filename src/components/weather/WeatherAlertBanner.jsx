import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

const severityStyles = {
  danger: { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-400', icon: 'text-rose-500' },
  warning: { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-400', icon: 'text-amber-500' },
  info: { bg: 'bg-sky-500/15', border: 'border-sky-500/30', text: 'text-sky-400', icon: 'text-sky-500' },
};

export default function WeatherAlertBanner({ alerts = [] }) {
  const [dismissed, setDismissed] = useState(new Set());
  const visible = alerts.filter(a => !dismissed.has(a.type));
  if (!visible.length) return null;

  return (
    <AnimatePresence>
      {visible.map((alert) => {
        const s = severityStyles[alert.severity] || severityStyles.info;
        return (
          <motion.div
            key={alert.type}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`${s.bg} backdrop-blur-md border ${s.border} rounded-xl px-4 py-2.5 flex items-center justify-between mb-3`}
          >
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={14} className={s.icon} />
              <p className={`text-xs font-medium ${s.text}`}>{alert.message}</p>
            </div>
            <button
              onClick={() => setDismissed(prev => new Set([...prev, alert.type]))}
              className={`p-0.5 rounded hover:bg-white/10 ${s.text}`}
            >
              <X size={14} />
            </button>
          </motion.div>
        );
      })}
    </AnimatePresence>
  );
}

