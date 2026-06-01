'use client';

import { useState } from 'react';

const TIME_PRESETS = [5, 10, 20, 30, 45];

export default function EnergyTimePicker({ onConfirm }: { onConfirm: (energy: number, timeMin: number) => void }) {
    const [energy, setEnergy] = useState(3);
    const [timeMin, setTimeMin] = useState(20);

    const energyLabels = ['very low', 'low', 'moderate', 'high', 'very high'];

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">Energy level</h3>
                    <span className="text-xs opacity-50 italic">{energyLabels[energy - 1]}</span>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => setEnergy(n)}
                            className={`flex-1 text-center font-bold py-3 rounded-xl transition-all ${energy === n ? 'bg-primary text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-700 text-foreground/60 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                        >
                            {n}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-sm">Time available</h3>
                    <span className="text-xs opacity-50 italic">{timeMin} min</span>
                </div>
                <div className="flex gap-2">
                    {TIME_PRESETS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTimeMin(t)}
                            className={`flex-1 text-center font-bold py-3 rounded-xl transition-all ${timeMin === t ? 'bg-primary text-white shadow-md scale-105' : 'bg-slate-100 dark:bg-slate-700 text-foreground/60 hover:bg-slate-200 dark:hover:bg-slate-600'}`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <button
                onClick={() => onConfirm(energy, timeMin)}
                className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 text-lg"
            >
                Deal me in →
            </button>
        </div>
    );
}
