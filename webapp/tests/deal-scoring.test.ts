import { describe, it, expect } from 'vitest';
import { scoreAndSelectTasks, DealInput } from '@/lib/scan/deal';

function makeInput(overrides: Partial<DealInput> = {}): DealInput {
  return {
    tasks: [
      { id: 't1', title: 'Clean sink', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
      { id: 't2', title: 'Empty dishwasher', roomId: 'room-a', effort: 1, minutesEst: 7, status: 'OPEN' },
      { id: 't3', title: 'Mop floor', roomId: 'room-a', effort: 4, minutesEst: 30, status: 'OPEN' },
    ],
    failedCheckTaskIds: new Set<string>(),
    selectedRoomId: 'room-a',
    energy: 3,
    timeMin: 30,
    recentSkipTaskIds: new Set<string>(),
    recentDoneTaskIds: new Set<string>(),
    handSize: 3,
    ...overrides,
  };
}

describe('scoreAndSelectTasks', () => {
  it('ranks failed-check-linked tasks above unrelated tasks', () => {
    const input = makeInput({
      failedCheckTaskIds: new Set(['t1']),
    });
    const result = scoreAndSelectTasks(input);
    expect(result[0].taskId).toBe('t1');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('penalizes effort above energy', () => {
    const input = makeInput({
      tasks: [
        { id: 't1', title: 'Low effort', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
        { id: 't2', title: 'High effort', roomId: 'room-a', effort: 5, minutesEst: 10, status: 'OPEN' },
      ],
      energy: 3,
    });
    const result = scoreAndSelectTasks(input);
    const t1 = result.find(t => t.taskId === 't1')!;
    const t2 = result.find(t => t.taskId === 't2')!;
    expect(t1.score).toBeGreaterThan(t2.score);
  });

  it('penalizes minutes above time budget', () => {
    const input = makeInput({
      tasks: [
        { id: 't1', title: 'Quick task', roomId: 'room-a', effort: 2, minutesEst: 5, status: 'OPEN' },
        { id: 't2', title: 'Long task', roomId: 'room-a', effort: 2, minutesEst: 60, status: 'OPEN' },
      ],
      timeMin: 20,
    });
    const result = scoreAndSelectTasks(input);
    const t1 = result.find(t => t.taskId === 't1')!;
    const t2 = result.find(t => t.taskId === 't2')!;
    expect(t1.score).toBeGreaterThan(t2.score);
  });

  it('lowers priority for recently skipped tasks', () => {
    const input = makeInput({
      tasks: [
        { id: 't1', title: 'Task A', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
        { id: 't2', title: 'Task B (skipped)', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
      ],
      recentSkipTaskIds: new Set(['t2']),
    });
    const result = scoreAndSelectTasks(input);
    const t1 = result.find(t => t.taskId === 't1')!;
    const t2 = result.find(t => t.taskId === 't2')!;
    expect(t1.score).toBeGreaterThan(t2.score);
  });

  it('loses not-done-recently boost for recently done tasks', () => {
    const input = makeInput({
      tasks: [
        { id: 't1', title: 'Task A (done recently)', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
        { id: 't2', title: 'Task B', roomId: 'room-a', effort: 2, minutesEst: 10, status: 'OPEN' },
      ],
      recentDoneTaskIds: new Set(['t1']),
    });
    const result = scoreAndSelectTasks(input);
    const t1 = result.find(t => t.taskId === 't1')!;
    const t2 = result.find(t => t.taskId === 't2')!;
    expect(t2.score).toBeGreaterThan(t1.score);
  });

  it('respects hand size limit', () => {
    const input = makeInput({
      tasks: [
        { id: 't1', title: 'Task 1', roomId: 'room-a', effort: 1, minutesEst: 5, status: 'OPEN' },
        { id: 't2', title: 'Task 2', roomId: 'room-a', effort: 1, minutesEst: 5, status: 'OPEN' },
        { id: 't3', title: 'Task 3', roomId: 'room-a', effort: 1, minutesEst: 5, status: 'OPEN' },
        { id: 't4', title: 'Task 4', roomId: 'room-a', effort: 1, minutesEst: 5, status: 'OPEN' },
        { id: 't5', title: 'Task 5', roomId: 'room-a', effort: 1, minutesEst: 5, status: 'OPEN' },
      ],
      handSize: 2,
    });
    const result = scoreAndSelectTasks(input);
    expect(result.length).toBe(2);
  });

  it('returns empty hand for empty task list', () => {
    const input = makeInput({
      tasks: [],
    });
    const result = scoreAndSelectTasks(input);
    expect(result).toHaveLength(0);
  });
});
