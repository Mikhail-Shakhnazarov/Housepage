'use client';

import React, { useState, useEffect } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';

interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    dueDate?: string;
    assigneeName?: string;
}

const ChoreList: React.FC = () => {
    const { activeHousehold } = useHousehold();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (activeHousehold) {
            fetch(`/api/chores?householdId=${activeHousehold.id}`)
                .then(res => res.json())
                .then(data => {
                    setTasks(data);
                    setIsLoading(false);
                });
        }
    }, [activeHousehold]);

    if (!activeHousehold) return <div className="text-sm opacity-50">Select a household to see chores.</div>;
    if (isLoading) return <div className="animate-pulse space-y-4">...</div>;

    return (
        <div className="space-y-4">
            {tasks.length === 0 ? (
                <div className="text-center p-8 border-2 border-dashed border-border rounded-xl opacity-40">
                    No chores yet. Add one!
                </div>
            ) : (
                tasks.map(task => (
                    <div key={task.id} className="wedge-card group hover:border-primary transition-colors">
                        <div className="flex justify-between items-start">
                            <div className="flex-1">
                                <h4 className="font-semibold">{task.title}</h4>
                                {task.description && <p className="text-xs opacity-60 mt-1">{task.description}</p>}
                                <div className="flex items-center gap-3 mt-3">
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${task.status === 'OVERDUE' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600'
                                        }`}>
                                        {task.status}
                                    </span>
                                    {task.dueDate && (
                                        <span className="text-[10px] opacity-50">due {new Date(task.dueDate).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold opacity-30 mb-1">WHO</div>
                                <div className="text-xs font-medium bg-slate-50 border border-border px-2 py-1 rounded">
                                    {task.assigneeName || 'Unassigned'}
                                </div>
                            </div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-xs font-bold bg-primary text-white px-3 py-1.5 rounded-lg">DONE</button>
                            <button className="text-xs font-bold border border-border px-3 py-1.5 rounded-lg hover:bg-slate-50">SKIP</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

export default ChoreList;
