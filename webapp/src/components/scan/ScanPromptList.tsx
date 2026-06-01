'use client';

import { useHousehold } from '@/components/HouseholdProvider';
import { useState, useEffect, useCallback } from 'react';

interface Check {
    id: string;
    sourceKey: string;
    prompt: string;
    linkedTaskIds: string[];
}

interface CheckAnswer {
    checkId: string;
    answer: 'yes' | 'no';
}

export default function ScanPromptList({
    roomId,
    onComplete,
}: {
    roomId: string;
    onComplete: (answers: CheckAnswer[]) => void;
}) {
    const { activeHousehold } = useHousehold();
    const [checks, setChecks] = useState<Check[]>([]);
    const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!activeHousehold) return;
        fetch(`/api/scan/checks?householdId=${activeHousehold.id}&roomId=${roomId}`)
            .then(r => {
                if (!r.ok) throw new Error('Failed to load checks');
                return r.json();
            })
            .then(data => {
                setChecks(data.checks);
                setIsLoading(false);
            })
            .catch(e => {
                setError(e.message);
                setIsLoading(false);
            });
    }, [activeHousehold, roomId]);

    const setAnswer = useCallback((checkId: string, answer: 'yes' | 'no') => {
        setAnswers(prev => ({ ...prev, [checkId]: answer }));
    }, []);

    if (isLoading) {
        return <div className="animate-pulse space-y-4">{' '}<div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /><div className="h-16 bg-slate-200 dark:bg-slate-700 rounded-xl" /></div>;
    }
    if (error) {
        return <div className="wedge-card text-red-600 text-sm">{error}</div>;
    }
    if (checks.length === 0) {
        return (
            <div className="wedge-card text-center py-8">
                <p className="opacity-40 text-lg mb-2">No check prompts for this room</p>
                <p className="opacity-30 text-sm">Define scan checks in settings to enable scanning.</p>
            </div>
        );
    }

    const allAnswered = checks.every(c => answers[c.id] != null);

    return (
        <div className="space-y-3">
            {checks.map(check => {
                const val = answers[check.id];
                return (
                    <div key={check.id} className={`wedge-card transition-colors ${val ? 'border-primary/30' : 'border-dashed border-amber-200'}`}>
                        <p className="font-medium text-sm mb-3">{check.prompt}</p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setAnswer(check.id, 'yes')}
                                className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${val === 'yes' ? 'bg-green-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-foreground/60 hover:bg-green-50'}`}
                            >
                                YES ✓
                            </button>
                            <button
                                onClick={() => setAnswer(check.id, 'no')}
                                className={`flex-1 text-sm font-bold py-2 rounded-lg transition-all ${val === 'no' ? 'bg-red-600 text-white shadow-md' : 'bg-slate-100 dark:bg-slate-700 text-foreground/60 hover:bg-red-50'}`}
                            >
                                NO ✗
                            </button>
                        </div>
                    </div>
                );
            })}
            {!allAnswered && (
                <p className="text-xs opacity-40 text-center pt-2">Answer all prompts to continue</p>
            )}
            {allAnswered && (
                <button
                    onClick={() => onComplete(checks.map(c => ({ checkId: c.id, answer: answers[c.id] })))}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                >
                    Continue →
                </button>
            )}
        </div>
    );
}
