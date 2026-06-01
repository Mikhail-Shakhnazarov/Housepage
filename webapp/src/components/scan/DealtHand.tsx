'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DealtTask {
    taskId: string;
    title: string;
    roomId: string | null;
    effort: number | null;
    minutesEst: number | null;
    score: number;
    reason: string;
}

export default function DealtHand({
    tasks,
    onAction,
    onScanAgain,
}: {
    tasks: DealtTask[];
    onAction: (taskId: string, action: 'done' | 'skip') => Promise<void>;
    onScanAgain: () => void;
}) {
    const [actingTaskId, setActingTaskId] = useState<string | null>(null);
    const [feedback, setFeedback] = useState<{ taskId: string; message: string } | null>(null);
    const [doneTasks, setDoneTasks] = useState<Set<string>>(new Set());

    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const handleAction = async (taskId: string, action: 'done' | 'skip') => {
        setActingTaskId(taskId);
        setErrorMessage(null);
        try {
            await onAction(taskId, action);
            setDoneTasks(prev => new Set(prev).add(taskId));
            const label = action === 'done' ? 'Done!' : 'Skipped';
            setFeedback({ taskId, message: label });
            setTimeout(() => setFeedback(null), 2000);
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Action failed';
            setErrorMessage(msg);
        } finally {
            setActingTaskId(null);
        }
    };

    if (tasks.length === 0) {
        return (
            <div className="wedge-card text-center py-8">
                <p className="opacity-40 text-lg mb-2">No tasks dealt</p>
                <p className="opacity-30 text-sm mb-4">Try adjusting energy or time.</p>
                <button onClick={onScanAgain} className="text-primary font-bold text-sm hover:underline">Scan another room</button>
            </div>
        );
    }

    const remainingTasks = tasks.filter(t => !doneTasks.has(t.taskId));
    const allDone = remainingTasks.length === 0;

    return (
        <div className="space-y-3">
            {errorMessage && (
                <div className="wedge-card border-red-300 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-sm p-3 rounded-xl">
                    {errorMessage}
                </div>
            )}
            <AnimatePresence>
                {tasks.map(task => {
                    const isDone = doneTasks.has(task.taskId);
                    const isActing = actingTaskId === task.taskId;
                    const fb = feedback?.taskId === task.taskId ? feedback.message : null;

                    return (
                        <motion.div
                            key={task.taskId}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: isDone ? 0.4 : 1, y: 0 }}
                            exit={{ opacity: 0, height: 0 }}
                            className={`wedge-card transition-all ${isDone ? 'opacity-40' : ''}`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-bold">{task.title}</h4>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {task.minutesEst != null && (
                                            <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded">{task.minutesEst} min</span>
                                        )}
                                        {task.effort != null && (
                                            <span className="text-[10px] font-bold bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded">effort {task.effort}/5</span>
                                        )}
                                        <span className="text-[10px] italic opacity-40 px-1">{task.reason}</span>
                                    </div>
                                </div>
                                {!isDone && (
                                    <div className="flex gap-2 flex-shrink-0">
                                        <button
                                            onClick={() => handleAction(task.taskId, 'done')}
                                            disabled={isActing}
                                            className="bg-green-600 text-white text-xs font-bold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                        >
                                            {isActing ? '...' : 'Done'}
                                        </button>
                                        <button
                                            onClick={() => handleAction(task.taskId, 'skip')}
                                            disabled={isActing}
                                            className="border border-border text-xs font-bold px-4 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                                        >
                                            Skip
                                        </button>
                                    </div>
                                )}
                                {isDone && fb && (
                                    <span className="text-xs font-bold text-green-600 flex-shrink-0">{fb}</span>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>

            {allDone && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="wedge-card text-center py-6 border-green-300">
                    <p className="text-green-600 font-bold text-lg mb-2">All tasks handled!</p>
                    <button onClick={onScanAgain} className="text-primary font-bold text-sm hover:underline">
                        Scan another room →
                    </button>
                </motion.div>
            )}
        </div>
    );
}
