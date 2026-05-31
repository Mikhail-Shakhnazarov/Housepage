### Data Processing Region

The **data processing** region is responsible for transforming the raw data (scan answers, task definitions, events) into actionable task suggestions based on the user’s inputs (energy level, time available). The key elements here are **task selection**, **task prioritization**, **scan handling**, and **outcome handling**.

---

## Key Responsibilities

1. **Maintain Derived State** (from tasks, checks, and events)
    
2. **Handle Scan Inputs** (generate actions based on scan answers)
    
3. **Task Selection & Prioritization** (pick tasks based on energy/time)
    
4. **Outcome Handling** (update state based on task completion or skip)
    

---

### 1. **Maintain Derived State**

The derived state is computed dynamically from task definitions, checks, and event history. The core idea is to compute **task status**, **urgency**, and **priority** from these sources.

- **Task state** is derived from the event log (`events.ndjson`). This includes:
    
    - `last_done_ts` (last time the task was marked "Done")
        
    - `skip_count` (how many times the task was skipped in the last X days)
        
    - `overdue_score` (how overdue the task is based on `last_done_ts` vs frequency)
        
    - `scan_boost` (temporary priority boost due to recent scan answers)
        
    - `active` (whether the task is currently relevant or disabled, based on `disabled` flag or N/A answers)
        

This is computed each time the app requests a task list and can be cached in memory for performance.

Example derived state for a task:

```json
{
  "task_id": "t_kitchen_clean_sink",
  "last_done_ts": "2025-12-14T10:20:00+01:00",
  "skip_count": 2,
  "overdue_score": 3,
  "scan_boost": 1,
  "active": true
}
```

### 2. **Handle Scan Inputs**

When a room is scanned, each room has a set of predefined checks (from `checks.json`). These checks are answered with "Yes", "No", or "N/A". The key logic is that:

- **"No" answers** trigger actions by **raising the priority** of linked tasks (tasks associated with that check).
    
- **"N/A" answers** temporarily disable those checks/tasks unless re-enabled by a future scan.
    

On each scan answer, the app will:

- **Raise priority** of tasks linked to "No" answers. The boost should decay over time to prevent it from dominating forever (e.g., a boost that lasts 1–2 days).
    
- **Disable tasks** linked to "N/A" answers until re-enabled (or until the context changes in the scan).
    
- Record the scan event in `events.ndjson` with `type: "scan_answer"`, and for each affected task, a boost or disable flag will be updated.
    

Example scan processing (pseudo-code):

```javascript
// For each scan answer:
if (answer == "no") {
  // Find linked tasks and boost priority
  for (let task of linkedTasks) {
    task.scan_boost += 1;  // Raise priority
  }
} else if (answer == "na") {
  // Disable tasks linked to N/A
  for (let task of linkedTasks) {
    task.active = false;
  }
}
// Append scan event to events.ndjson
logEvent({ type: "scan_answer", task_id: task.id, answer });
```

### 3. **Task Selection & Prioritization**

When the user selects an energy level and time available, the app needs to **filter** the task pool and **select** a small set of tasks that fit. Here's how the process works:

#### Task Filtering:

1. **Energy Level & Time Constraints**:
    
    - Filter out tasks that don't fit the selected energy and time.
        
    - Tasks that are too “big” or require more time than available are excluded.
        
    - This can be done by comparing task `effort` (1–5) and `minutes_est` against the user’s input.
        
2. **Exclusion of Disabled Tasks**:
    
    - Tasks marked as “inactive” due to an N/A scan answer should be excluded.
        

#### Task Scoring:

After filtering, each remaining task is scored based on a few factors:

- **Overdue score**: How overdue is this task? If it's due, the score increases (i.e., priority rises).
    
- **Scan boost**: Tasks that were recently “raised” by a scan answer get a temporary priority boost.
    
- **Comfort blockers**: Tasks that are obvious blockers (e.g., garbage, dirty dishes) get an additional priority boost.
    

The formula could look like:

```javascript
score = (overdue_score * 2) + scan_boost + (is_comfort_blocker ? 2 : 0)
```

#### Task Selection:

- From the filtered and scored tasks, the app selects **N tasks** (usually 3).
    
- The selection prioritizes:
    
    - **Overdue tasks** (tasks that are overdue or need attention soon).
        
    - **Comfort blockers** (tasks that prevent a tidy environment).
        
    - **Scan-raised tasks** (recently flagged tasks with high priority).
        

Once the tasks are selected, they are presented to the user.

```json
{
  "tasks": [
    { "task_id": "t_kitchen_clean_sink", "title": "Clean sink", "minutes_est": 5, "effort": 2, "priority_score": 4 },
    { "task_id": "t_living_vacuum", "title": "Vacuum living room", "minutes_est": 15, "effort": 3, "priority_score": 5 },
    { "task_id": "t_bathroom_clean_toilet", "title": "Clean toilet", "minutes_est": 10, "effort": 3, "priority_score": 6 }
  ]
}
```

### 4. **Outcome Handling**

When a user interacts with a task (Done / Skip / N/A), the app updates the system state and writes the action to the event log (`events.ndjson`). The outcome handling works as follows:

- **Task Completed (Done)**:
    
    - Reset the task’s overdue score (set `last_done_ts` to the current time).
        
    - Remove any temporary scan boost.
        
    - Mark it as completed in the event log.
        
- **Task Skipped**:
    
    - Log the skip event.
        
    - Optionally increment the skip counter.
        
    - If skipped repeatedly, increase the “friction” on the task and tag it for future review (e.g., splitting or renaming if too big).
        
- **Not Applicable (N/A)**:
    
    - Mark the task as inactive (temporarily disable it).
        
    - Add a N/A event to the log.
        
    - This task will not surface again until it’s re-enabled.
        

Example event handling for Done/Skip/N/A:

```javascript
if (action == "done") {
  task.last_done_ts = currentTime; // Update last done time
  task.scan_boost = 0;  // Reset scan boost
  task.overdue_score = 0;  // Reset overdue score
} else if (action == "skip") {
  task.skip_count += 1;
  if (task.skip_count > 3) {
    task.friction = true;  // Flag as needing a future review (split/rename)
  }
} else if (action == "na") {
  task.active = false;  // Disable task until re-enabled
}
```

### Summary of Data Processing Flow:

1. **Scan inputs** adjust task priority temporarily via scan boosts and disable tasks via N/A.
    
2. **Task selection** filters tasks based on energy/time, then scores and prioritizes based on urgency, comfort, and scan results.
    
3. **Outcome handling** updates the task state and appends events based on user interactions (Done / Skip / N/A).
    
4. The app ensures the task pool stays manageable and actionable over time by preventing unnecessary task duplication and enforcing skip cooldowns.
    

---

This is the minimal setup for data processing. The core of this processing is filtering, scoring, and handling scan inputs correctly, followed by handling task interactions with clear, predictable consequences. The system gets smarter over time because it uses a history of user actions (via events) to adjust priorities and friction.