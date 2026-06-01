'use client';

import { useReducer, useCallback } from 'react';
import { useHousehold } from '@/components/HouseholdProvider';
import RoomPicker from './RoomPicker';
import ScanPromptList from './ScanPromptList';
import EnergyTimePicker from './EnergyTimePicker';
import DealtHand from './DealtHand';

interface Room {
    id: string;
    slug: string;
    name: string;
}

interface CheckAnswer {
    checkId: string;
    answer: 'yes' | 'no';
}

interface DealtTask {
    taskId: string;
    title: string;
    roomId: string | null;
    effort: number | null;
    minutesEst: number | null;
    score: number;
    reason: string;
}

type Phase =
    | { name: 'idle' }
    | { name: 'scanning'; room: Room }
    | { name: 'ready_to_deal'; room: Room; scanSessionId: string }
    | { name: 'dealing'; room: Room; scanSessionId: string }
    | { name: 'hand'; room: Room; tasks: DealtTask[]; dealId: string }
    | { name: 'submitting_action' }
    | { name: 'error'; message: string };

interface State {
    phase: Phase;
    lastScanSessionId: string | null;
}

type Action =
    | { type: 'SELECT_ROOM'; room: Room }
    | { type: 'ANSWERS_SUBMITTED'; room: Room; scanSessionId: string }
    | { type: 'START_DEALING' }
    | { type: 'DEAL_COMPLETE'; tasks: DealtTask[]; dealId: string; room: Room }
    | { type: 'ACTION_DONE' }
    | { type: 'ERROR'; message: string }
    | { type: 'RESET' };

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case 'SELECT_ROOM':
            return { ...state, phase: { name: 'scanning', room: action.room } };
        case 'ANSWERS_SUBMITTED':
            return { ...state, phase: { name: 'ready_to_deal', room: action.room, scanSessionId: action.scanSessionId }, lastScanSessionId: action.scanSessionId };
        case 'START_DEALING': {
            const p = state.phase;
            if (p.name !== 'ready_to_deal') return state;
            return { ...state, phase: { name: 'dealing', room: p.room, scanSessionId: p.scanSessionId } };
        }
        case 'DEAL_COMPLETE':
            return { ...state, phase: { name: 'hand', room: action.room, tasks: action.tasks, dealId: action.dealId } };
        case 'ACTION_DONE':
            return state;
        case 'ERROR':
            return { ...state, phase: { name: 'error', message: action.message } };
        case 'RESET':
            return { phase: { name: 'idle' }, lastScanSessionId: null };
        default:
            return state;
    }
}

export default function ScanLoop() {
    const { activeHousehold } = useHousehold();
    const [state, dispatch] = useReducer(reducer, { phase: { name: 'idle' }, lastScanSessionId: null });

    const handleRoomSelect = useCallback((room: Room) => {
        dispatch({ type: 'SELECT_ROOM', room });
    }, []);

    const handleAnswersComplete = useCallback(async (room: Room, answers: CheckAnswer[]) => {
        if (!activeHousehold) return;
        try {
            const res = await fetch('/api/scan/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    householdId: activeHousehold.id,
                    roomId: room.id,
                    clientTs: new Date().toISOString(),
                    answers,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Scan submit failed' }));
                throw new Error(err.error || 'Scan submit failed');
            }
            const data = await res.json();
            dispatch({ type: 'ANSWERS_SUBMITTED', room, scanSessionId: data.scanSessionId });
            window.dispatchEvent(new CustomEvent('housepage:feed-update'));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to submit scan answers';
            dispatch({ type: 'ERROR', message: msg });
        }
    }, [activeHousehold]);

    const handleEnergyTimeConfirm = useCallback(async (room: Room, scanSessionId: string, energy: number, timeMin: number) => {
        if (!activeHousehold) return;
        dispatch({ type: 'START_DEALING' });
        try {
            const res = await fetch('/api/deal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    householdId: activeHousehold.id,
                    roomId: room.id,
                    scanSessionId,
                    energy,
                    timeMin,
                    handSize: 3,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: 'Deal request failed' }));
                throw new Error(err.error || 'Deal request failed');
            }
            const data = await res.json();
            dispatch({ type: 'DEAL_COMPLETE', tasks: data.tasks, dealId: data.dealId, room });
            window.dispatchEvent(new CustomEvent('housepage:feed-update'));
        } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Failed to deal tasks';
            dispatch({ type: 'ERROR', message: msg });
        }
    }, [activeHousehold]);

    const handleTaskAction = useCallback(async (taskId: string, action: 'done' | 'skip') => {
        if (!activeHousehold) return;
        const p = state.phase;
        if (p.name !== 'hand') return;
        const res = await fetch('/api/task/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                householdId: activeHousehold.id,
                taskId,
                roomId: p.room.id,
                dealId: p.dealId,
                action,
                clientTs: new Date().toISOString(),
            }),
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({ error: 'Action failed' }));
            throw new Error(err.error || 'Action failed');
        }
        dispatch({ type: 'ACTION_DONE' });
        window.dispatchEvent(new CustomEvent('housepage:feed-update'));
    }, [activeHousehold, state.phase]);

    const handleScanAgain = useCallback(() => {
        dispatch({ type: 'RESET' });
    }, []);

    const p = state.phase;

    if (p.name === 'error') {
        return (
            <div className="wedge-card text-center py-8 border-red-200">
                <p className="text-red-600 font-bold mb-2">Something went wrong</p>
                <p className="text-sm opacity-60 mb-4">{p.message}</p>
                <button onClick={handleScanAgain} className="text-primary font-bold text-sm hover:underline">Try again</button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold tracking-tight">Scan a Room</h2>
                {p.name !== 'idle' && (
                    <button onClick={handleScanAgain} className="text-xs opacity-40 hover:opacity-100 transition-opacity">
                        Reset
                    </button>
                )}
            </div>

            {p.name === 'idle' && (
                <div>
                    <p className="text-sm opacity-50 mb-4">Pick a room to scan and get a dealt hand of tasks.</p>
                    <RoomPicker onSelect={handleRoomSelect} />
                </div>
            )}

            {(p.name === 'scanning' || p.name === 'ready_to_deal') && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm opacity-50">Scanning:</span>
                        <span className="font-bold">{p.name === 'scanning' ? (p as { room: Room }).room.name : (p as { room: Room }).room.name}</span>
                    </div>
                    {p.name === 'scanning' && (
                        <ScanPromptList
                            key={(p as { room: Room }).room.id}
                            roomId={(p as { room: Room }).room.id}
                            onComplete={(answers) => handleAnswersComplete((p as { room: Room }).room, answers)}
                        />
                    )}
                    {p.name === 'ready_to_deal' && (
                        <div>
                            <p className="text-sm text-green-600 font-bold mb-4">Scan complete! Set your energy and time.</p>
                            <EnergyTimePicker
                                onConfirm={(energy, timeMin) =>
                                    handleEnergyTimeConfirm(
                                        (p as { room: Room; scanSessionId: string }).room,
                                        (p as { room: Room; scanSessionId: string }).scanSessionId,
                                        energy,
                                        timeMin
                                    )
                                }
                            />
                        </div>
                    )}
                </div>
            )}

            {p.name === 'dealing' && (
                <div className="wedge-card text-center py-12">
                    <div className="animate-pulse">
                        <p className="text-lg font-bold opacity-40">Dealing your hand...</p>
                        <p className="text-sm opacity-30 mt-2">Finding the right tasks for you</p>
                    </div>
                </div>
            )}

            {p.name === 'hand' && (
                <div>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm opacity-50">Your hand for</span>
                        <span className="font-bold">{p.room.name}</span>
                    </div>
                    <DealtHand tasks={p.tasks} onAction={handleTaskAction} onScanAgain={handleScanAgain} />
                </div>
            )}
        </div>
    );
}
