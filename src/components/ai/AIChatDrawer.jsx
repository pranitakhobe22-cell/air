import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BrainCircuit, Send, User, X } from 'lucide-react';
import axios from 'axios';
import useAerisStore from '@/store/aerisStore';

const aiApi = axios.create({
  baseURL: import.meta.env.VITE_WEATHER_URL || 'http://localhost:3000/api/v1',
  timeout: 30000,
});

function renderMarkdown(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    line = line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    line = line.replace(/_(.+?)_/g, '<em>$1</em>');
    if (line.trim().startsWith('- ') || line.trim().startsWith('• '))
      return <li key={i} className="ml-4 list-disc text-[13px]" dangerouslySetInnerHTML={{ __html: line.replace(/^[\s]*[-•]\s*/, '') }} />;
    if (line.startsWith('### ')) return <h4 key={i} className="font-semibold mt-2 mb-1 text-(--color-text-primary) text-[13px]">{line.replace('### ', '')}</h4>;
    if (line.startsWith('## ')) return <h3 key={i} className="font-bold mt-3 mb-1 text-(--color-text-primary) text-sm">{line.replace('## ', '')}</h3>;
    if (line.trim() === '') return <br key={i} />;
    return <p key={i} className="text-[13px]" dangerouslySetInnerHTML={{ __html: line }} />;
  });
}

export default function AIChatDrawer({ open, onClose }) {
  const data = useAerisStore((s) => s.data);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'Hello! I\'m **AERIS AI** — your environmental intelligence assistant.\n\nI can help with:\n- Current AQI and air quality analysis\n- Route safety recommendations\n- Health advice based on live sensor data\n- Pollution exposure guidance\n\nHow can I assist you?' }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef(null);

  const sensors = data?.sensors || {};
  const environment = data?.environment || {};
  const aqi = data?.derived?.aqi || 0;
  const category = data?.derived?.aqi_category || 'Unknown';
  const dominant = data?.derived?.dominant || 'PM2.5';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || typing) return;

    const userMsg = { role: 'user', content: input };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput('');
    setTyping(true);

    try {
      const { data: res } = await aiApi.post('/ai/chat', {
        messages: updated.map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content })),
        sensors, environment, aqi, category, dominant,
        city: data?.meta?.location || 'Unknown',
      });
      setMessages(prev => [...prev, { role: 'ai', content: res.data?.content || 'Sorry, I could not process that.' }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'ai',
        content: aqi > 100
          ? `Based on current AQI of **${aqi}**, air quality needs attention.\n- Limit outdoor exposure\n- Wear a mask if going out\n- PM2.5: ${sensors.pm25 || 0} µg/m³`
          : `Current AQI is **${aqi}** — conditions are ${aqi <= 50 ? 'good' : 'moderate'}.\n- Safe for most outdoor activities\n- PM2.5: ${sensors.pm25 || 0} µg/m³\n\n_AI service unavailable — rule-based response._`
      }]);
    } finally {
      setTyping(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[90]"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] z-[100] flex flex-col glass-sidebar"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-(--color-card-border)">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-(--color-accent)/10 flex items-center justify-center">
                  <BrainCircuit size={16} className="text-(--color-accent)" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-(--color-text-primary)">AERIS AI</h3>
                  <p className="text-[10px] text-(--color-text-secondary)">Environmental Intelligence</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold uppercase tracking-wider border border-emerald-500/20">Active</span>
                <button onClick={onClose} className="p-1.5 rounded-lg text-(--color-text-secondary) hover:text-(--color-text-primary) hover:bg-white/10 transition-colors">
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Context bar */}
            <div className="px-5 py-2.5 border-b border-(--color-card-border) flex items-center gap-4 text-[10px] text-(--color-text-secondary)">
              <span>AQI: <strong className="text-(--color-text-primary)">{aqi}</strong></span>
              <span>PM2.5: <strong className="text-(--color-text-primary)">{sensors.pm25?.toFixed?.(1) || '—'}</strong></span>
              <span>Temp: <strong className="text-(--color-text-primary)">{environment.temperature?.toFixed?.(1) || '—'}°C</strong></span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 glass-scrollbar">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user'
                      ? 'bg-(--color-primary) text-white'
                      : 'bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20'
                  }`}>
                    {msg.role === 'user' ? <User size={12} /> : <BrainCircuit size={12} />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl max-w-[85%] text-[13px] leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-(--color-primary) text-white rounded-tr-sm'
                      : 'glass-card rounded-tl-sm text-(--color-text-primary)'
                  }`}>
                    <div className="space-y-1">{renderMarkdown(msg.content)}</div>
                  </div>
                </div>
              ))}

              {typing && (
                <div className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-(--color-accent)/10 text-(--color-accent) border border-(--color-accent)/20 flex items-center justify-center shrink-0">
                    <BrainCircuit size={12} />
                  </div>
                  <div className="px-4 py-3 rounded-2xl glass-card rounded-tl-sm flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent)/60 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent)/60 animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-(--color-accent)/60 animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </div>
                </div>
              )}
              <div ref={endRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-(--color-card-border)">
              <form onSubmit={handleSend} className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about air quality, routes, health..."
                  className="flex-1 subtle-surface border border-(--color-card-border) rounded-xl px-4 py-3 text-[13px] text-(--color-text-primary) placeholder:text-(--color-text-secondary)/40 focus:outline-none focus:ring-2 focus:ring-(--color-accent)/30 transition-all"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || typing}
                  className="px-4 py-3 rounded-xl bg-(--color-primary) text-white disabled:opacity-40 hover:opacity-90 transition-all"
                >
                  <Send size={15} />
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

