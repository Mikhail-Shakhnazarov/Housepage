export interface ScoredTask {
  taskId: string;
  title: string;
  roomId: string | null;
  effort: number | null;
  minutesEst: number | null;
  score: number;
  reason: string;
}

export interface DealInput {
  tasks: Array<{
    id: string;
    title: string;
    roomId: string | null;
    effort: number | null;
    minutesEst: number | null;
    status: string;
  }>;
  failedCheckTaskIds: Set<string>;
  selectedRoomId: string;
  energy: number;
  timeMin: number;
  recentSkipTaskIds: Set<string>;
  recentDoneTaskIds: Set<string>;
  handSize: number;
}

export function scoreAndSelectTasks(input: DealInput): ScoredTask[] {
  const scored: ScoredTask[] = input.tasks.map((task) => {
    let score = 0;
    const reasons: string[] = [];

    if (input.failedCheckTaskIds.has(task.id)) {
      score += 10;
      reasons.push("linked to failed scan check");
    }

    if (task.roomId === input.selectedRoomId) {
      score += 3;
      reasons.push("room match");
    }

    if (task.effort !== null && task.effort <= input.energy) {
      score += 2;
      reasons.push("effort fits energy");
    }

    if (task.minutesEst !== null && task.minutesEst <= input.timeMin) {
      score += 2;
      reasons.push("time fits budget");
    }

    if (!input.recentDoneTaskIds.has(task.id)) {
      score += 1;
      reasons.push("not done recently");
    }

    if (input.recentSkipTaskIds.has(task.id)) {
      score -= 2;
      reasons.push("was skipped recently");
    }

    const reason = reasons.length > 0 ? reasons.join("; ") : "default";

    return {
      taskId: task.id,
      title: task.title,
      roomId: task.roomId,
      effort: task.effort,
      minutesEst: task.minutesEst,
      score,
      reason,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, input.handSize);
}
