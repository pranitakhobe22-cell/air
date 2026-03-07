import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, ArrowRight, Heart, Wind, Clock, ChevronRight } from 'lucide-react';
import aerisApi from '@/services/aerisApi';
import useAuthStore from '@/store/useAuthStore';
import { getStoredUser } from '@/services/auth';

const CONDITIONS = ['Asthma', 'COPD', 'Heart Disease', 'Diabetes', 'Allergies', 'Immunocompromised'];
const SENSITIVITIES = [
    { id: 'low', label: 'Low', desc: 'Healthy adult, no major concerns', color: '#10b981' },
    { id: 'moderate', label: 'Moderate', desc: 'Occasional mild respiratory issues', color: '#f59e0b' },
    { id: 'high', label: 'High', desc: 'Chronic conditions or elderly', color: '#f97316' },
    { id: 'very_high', label: 'Very High', desc: 'Severe conditions, children, pregnant', color: '#ef4444' },
];

export default function Onboarding() {
    const navigate = useNavigate();
    const setUser = useAuthStore((s) => s.setUser);
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        age: 28,
        sensitivity: 'moderate',
        conditions: [],
        outdoorExposureHours: 3,
    });

    const storedUser = getStoredUser();
    const firstName = storedUser?.name?.split(' ')[0] || 'there';

    const toggleCondition = (c) => {
        setForm(f => ({
            ...f,
            conditions: f.conditions.includes(c) ? f.conditions.filter(x => x !== c) : [...f.conditions, c],
        }));
    };

    const handleFinish = async () => {
        setSaving(true);
        try {
            await aerisApi.put('/profile', {
                age: form.age,
                sensitivity: form.sensitivity,
                conditions: form.conditions,
                outdoorExposureHours: form.outdoorExposureHours,
            });
            // Refresh user in store if stored
            if (storedUser) setUser(storedUser);
        } catch (e) {
            console.error('Onboarding save error:', e.message);
        } finally {
            setSaving(false);
            navigate('/dashboard');
        }
    };

    const steps = [
        // Step 0: Welcome
        {
            title: `Welcome, ${firstName}! 👋`,
            subtitle: 'Let\'s set up your health profile so AERIS can calculate your personal risk score.',
            icon: Shield,
            content: null,
        },
        // Step 1: Age
        {
            title: 'How old are you?',
            subtitle: 'Age affects how pollutants impact your respiratory system.',
            icon: Clock,
            content: (
                <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                        <input
                            type="number"
                            min={1} max={120}
                            value={form.age}
                            onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))}
                            className="w-40 text-center text-5xl font-black bg-transparent border-b-2 border-sky-400 focus:outline-none text-white py-2"
                        />
                        <span className="absolute -right-12 bottom-3 text-slate-500 font-bold text-lg">yrs</span>
                    </div>
                    <input
                        type="range" min={1} max={100} value={form.age}
                        onChange={e => setForm(f => ({ ...f, age: Number(e.target.value) }))}
                        className="w-full accent-sky-400"
                    />
                    <div className="flex justify-between w-full text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        <span>1</span><span>Child</span><span>Adult</span><span>Senior</span><span>100</span>
                    </div>
                </div>
            ),
        },
        // Step 2: Sensitivity
        {
            title: 'Your air sensitivity level',
            subtitle: 'This sets the base multiplier for your personal Risk Index (RRI).',
            icon: Wind,
            content: (
                <div className="space-y-3">
                    {SENSITIVITIES.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setForm(f => ({ ...f, sensitivity: s.id }))}
                            className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${form.sensitivity === s.id
                                    ? 'border-sky-400/60 bg-sky-500/10 shadow-[0_0_20px_rgba(56,189,248,0.1)]'
                                    : 'border-white/5 bg-white/3 hover:bg-white/5'
                                }`}
                        >
                            <div className="text-left">
                                <div className="font-black text-sm text-white">{s.label}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{s.desc}</div>
                            </div>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: form.sensitivity === s.id ? s.color : '#334155' }} />
                        </button>
                    ))}
                </div>
            ),
        },
        // Step 3: Conditions
        {
            title: 'Any pre-existing conditions?',
            subtitle: 'Select all that apply. This adjusts your risk exposure multipliers.',
            icon: Heart,
            content: (
                <div className="space-y-3">
                    <div className="flex flex-wrap gap-3">
                        {CONDITIONS.map(c => {
                            const sel = form.conditions.includes(c);
                            return (
                                <button
                                    key={c}
                                    onClick={() => toggleCondition(c)}
                                    className={`px-5 py-3 rounded-xl text-sm font-bold transition-all border ${sel
                                            ? 'bg-rose-500/20 border-rose-400/50 text-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.15)]'
                                            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                                        }`}
                                >
                                    {c}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setForm(f => ({ ...f, conditions: [] }))}
                        className="text-xs text-slate-600 hover:text-slate-400 transition-colors mt-2"
                    >
                        None of the above
                    </button>
                </div>
            ),
        },
        // Step 4: Outdoor exposure
        {
            title: 'Daily outdoor hours',
            subtitle: 'How many hours per day are you typically outdoors?',
            icon: Wind,
            content: (
                <div className="flex flex-col items-center space-y-6">
                    <div className="text-7xl font-black text-sky-400">
                        {form.outdoorExposureHours}h
                    </div>
                    <input
                        type="range" min={0} max={12} step={1} value={form.outdoorExposureHours}
                        onChange={e => setForm(f => ({ ...f, outdoorExposureHours: Number(e.target.value) }))}
                        className="w-full accent-sky-400"
                    />
                    <div className="flex justify-between w-full text-[10px] font-bold text-slate-600 uppercase tracking-widest">
                        <span>0h Indoors</span><span>6h Mixed</span><span>12h Outdoors</span>
                    </div>
                </div>
            ),
        },
    ];

    const isLast = step === steps.length - 1;
    const isFirst = step === 0;
    const currentStep = steps[step];
    const Icon = currentStep.icon;

    return (
        <div className="min-h-screen bg-[#080C16] flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.04),transparent_60%)]" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[200px] bg-sky-500/5 blur-[80px]" />

            {/* Progress dots */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 flex items-center space-x-2 z-10">
                {steps.map((_, i) => (
                    <div
                        key={i}
                        className={`rounded-full transition-all duration-500 ${i === step ? 'w-8 h-2 bg-sky-400' : i < step ? 'w-2 h-2 bg-sky-600' : 'w-2 h-2 bg-slate-700'
                            }`}
                    />
                ))}
            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.25 }}
                    className="w-full max-w-lg"
                >
                    <div className="bg-slate-900/70 backdrop-blur-2xl border border-white/8 rounded-3xl p-10 shadow-2xl">
                        {/* Step icon */}
                        <div className="w-14 h-14 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center mb-8">
                            <Icon className="w-7 h-7 text-sky-400" />
                        </div>

                        {/* Title */}
                        <h1 className="text-2xl font-black text-white mb-2">{currentStep.title}</h1>
                        <p className="text-sm text-slate-400 mb-8">{currentStep.subtitle}</p>

                        {/* Content */}
                        {currentStep.content && (
                            <div className="mb-8">{currentStep.content}</div>
                        )}

                        {/* Buttons */}
                        <div className={`flex ${isFirst ? 'justify-end' : 'justify-between'} items-center mt-6`}>
                            {!isFirst && (
                                <button
                                    onClick={() => setStep(s => s - 1)}
                                    className="text-sm font-bold text-slate-500 hover:text-slate-300 transition-colors"
                                >
                                    ← Back
                                </button>
                            )}

                            {isLast ? (
                                <button
                                    onClick={handleFinish}
                                    disabled={saving}
                                    className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 rounded-xl text-white font-black text-sm uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 shadow-[0_0_20px_rgba(56,189,248,0.3)]"
                                >
                                    <span>{saving ? 'Saving...' : 'Launch Dashboard'}</span>
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={() => setStep(s => s + 1)}
                                    className="flex items-center space-x-2 px-8 py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-white font-black text-sm uppercase tracking-widest transition-all"
                                >
                                    <span>{isFirst ? 'Get Started' : 'Continue'}</span>
                                    <ChevronRight size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
