import { useEffect, useState } from "react";

type Settings = {
  schema_version: number;
  defaults: {
    hand_size: number;
    scan_first: boolean;
    time_buckets_min: number[];
    energy_scale: string;
  };
  rooms: { id: string; label: string }[];
};

type Check = {
  id: string;
  room: string;
  prompt: string;
  linked_task_ids: string[];
  notes?: string | null;
};

type ChecksResponse = {
  schema_version: number;
  room: string;
  checks: Check[];
};

type ScanAnswer = { check_id: string; answer: "yes" | "no" };

type ScanSubmitResponse = {
  ok: boolean;
  session_id: string;
};

type DealTask = {
  task_id: string;
  title: string;
  room: string;
  effort: number;
  minutes_est: number;
  score: number;
};

type DealResponse = {
  tasks: DealTask[];
  session_id: string;
};

type TaskDef = {
  id: string;
  title: string;
  room: string;
  effort: number;
  minutes_est: number;
  frequency_days: number | null;
  kind: string;
  notes?: string | null;
};

type TasksFile = {
  schema_version: number;
  tasks: TaskDef[];
};

type ChecksFile = {
  schema_version: number;
  checks: Check[];
};

type TaskActionResponse = {
  ok: boolean;
  session_id: string;
  replacement_task?: DealTask | null;
};

type MetricsResponse = {
  days: number;
  range: { from: string; to: string };
  tasks_done_total: number;
  tasks_done_by_day: { day: string; count: number }[];
  tasks_done_by_room: { room: string; count: number }[];
  tasks_done_top: { task_id: string; title: string | null; room: string | null; count: number }[];
  deals_total: number;
  time_bucket_avg: number | null;
  time_bucket_counts: { time_min: number; count: number }[];
  scans_total: number;
  checks_no_total: number;
  checks_no_by_room: { room: string; count: number }[];
  checks_no_top: { check_id: string; prompt: string | null; room: string | null; count: number }[];
};

function getOrCreateDeviceId(): string {
  const key = "housepage_device_id";
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;
  const created =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `dev_${Date.now()}`;
  window.localStorage.setItem(key, created);
  return created;
}

export function App() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<{ id: string; label: string } | null>(null);
  const [checks, setChecks] = useState<ChecksResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [scanSubmitted, setScanSubmitted] = useState<ScanSubmitResponse | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [timeMin, setTimeMin] = useState<number | null>(null);
  const [dealt, setDealt] = useState<DealResponse | null>(null);
  const [deviceId] = useState(() => getOrCreateDeviceId());
  const [mode, setMode] = useState<"flow" | "library" | "metrics">("flow");

  const [defsHashes, setDefsHashes] = useState<{
    tasks_sha256: string;
    checks_sha256: string;
    settings_sha256: string;
  } | null>(null);

  const [libraryTab, setLibraryTab] = useState<"tasks" | "checks">("tasks");
  const [allTasks, setAllTasks] = useState<TaskDef[] | null>(null);
  const [allChecks, setAllChecks] = useState<Check[] | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);

  const [taskForm, setTaskForm] = useState<{
    id: string;
    title: string;
    room: string;
    effort: number;
    minutes_est: number;
    frequency_days: number | null;
    kind: string;
    notes: string | null;
  } | null>(null);

  const [checkForm, setCheckForm] = useState<{
    id: string;
    room: string;
    prompt: string;
    linked_task_ids: string[];
    notes: string | null;
  } | null>(null);

  const [metricsDays, setMetricsDays] = useState<number>(14);
  const [metrics, setMetrics] = useState<MetricsResponse | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch((e) => setError(String(e)));
  }, []);

  async function refreshLibrary() {
    setError(null);
    try {
      const [hashesResp, tasksResp, checksResp] = await Promise.all([
        fetch("/api/defs/hashes").then((r) => r.json()),
        fetch("/api/tasks").then((r) => r.json()),
        fetch("/api/checks/all").then((r) => r.json()),
      ]);
      setDefsHashes(hashesResp);
      const tasksFile = tasksResp as TasksFile;
      const checksFile = checksResp as ChecksFile;
      setAllTasks(tasksFile.tasks ?? []);
      setAllChecks(checksFile.checks ?? []);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (mode !== "library") return;
    refreshLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  async function refreshMetrics(nextDays?: number) {
    setError(null);
    setMetrics(null);
    try {
      const d = nextDays ?? metricsDays;
      const resp = await fetch(`/api/metrics?days=${encodeURIComponent(String(d))}`);
      const data = (await resp.json()) as MetricsResponse;
      if (!resp.ok) {
        throw new Error(JSON.stringify(data));
      }
      setMetrics(data);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    if (mode !== "metrics") return;
    refreshMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const taskGroupOrder: Array<{ roomId: string; label: string }> = [
    { roomId: "garbage", label: "GARBAGE" },
    { roomId: "kitchen", label: "KITCHEN" },
    { roomId: "cats", label: "CATS" },
    { roomId: "bathroom", label: "BATHROOM" },
    { roomId: "bedroom", label: "BEDROOM" },
    { roomId: "hallway", label: "HALLWAY" },
    { roomId: "laundry", label: "LAUNDRY" },
    { roomId: "supermarket", label: "SUPERMARKET" },
    { roomId: "shopping", label: "SHOPPING" },
    { roomId: "living_room", label: "LIVING ROOM" },
  ];

  useEffect(() => {
    if (!selectedRoom) {
      setChecks(null);
      setAnswers({});
      setScanSubmitted(null);
      setEnergy(null);
      setTimeMin(null);
      setDealt(null);
      return;
    }
    setError(null);
    setScanSubmitted(null);
    setEnergy(null);
    setTimeMin(null);
    setDealt(null);
    fetch(`/api/checks?room=${encodeURIComponent(selectedRoom.id)}`)
      .then((r) => r.json())
      .then(setChecks)
      .catch((e) => setError(String(e)));
  }, [selectedRoom]);

  const canSubmitScan =
    !!selectedRoom &&
    !!checks &&
    checks.checks.length > 0 &&
    checks.checks.every((c) => answers[c.id] === "yes" || answers[c.id] === "no");

  async function submitScan() {
    if (!selectedRoom || !checks) return;
    setError(null);
    setDealt(null);

    const payload = {
      room: selectedRoom.id,
      answers: checks.checks.map(
        (c): ScanAnswer => ({ check_id: c.id, answer: answers[c.id] })
      ),
      device_id: deviceId,
      client_ts: new Date().toISOString(),
    };

    try {
      const resp = await fetch("/api/scan/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as ScanSubmitResponse;
      if (!resp.ok) {
        throw new Error(JSON.stringify(data));
      }
      setScanSubmitted(data);
    } catch (e) {
      setError(String(e));
    }
  }

  const canDeal = !!scanSubmitted && energy !== null && timeMin !== null;

  async function dealTasks() {
    if (!selectedRoom || !settings || !scanSubmitted || energy === null || timeMin === null) return;
    setError(null);

    const payload = {
      room: selectedRoom.id,
      energy,
      time_min: timeMin,
      hand_size: settings.defaults.hand_size,
      session_id: scanSubmitted.session_id,
      device_id: deviceId,
      client_ts: new Date().toISOString(),
    };

    try {
      const resp = await fetch("/api/deal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as DealResponse;
      if (!resp.ok) {
        throw new Error(JSON.stringify(data));
      }
      setDealt(data);
    } catch (e) {
      setError(String(e));
    }
  }

  async function actOnTask(taskId: string, action: "done" | "skip") {
    if (!selectedRoom || !settings || !scanSubmitted || energy === null || timeMin === null || !dealt) return;
    setError(null);

    const currentIds = dealt.tasks.map((t) => t.task_id);
    const payload = {
      task_id: taskId,
      action,
      room: selectedRoom.id,
      energy,
      time_min: timeMin,
      hand_size: settings.defaults.hand_size,
      session_id: scanSubmitted.session_id,
      device_id: deviceId,
      client_ts: new Date().toISOString(),
      current_hand_task_ids: currentIds,
    };

    try {
      const resp = await fetch("/api/task/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await resp.json()) as TaskActionResponse;
      if (!resp.ok) {
        throw new Error(JSON.stringify(data));
      }

      setDealt((prev) => {
        if (!prev) return prev;
        const idx = prev.tasks.findIndex((t) => t.task_id === taskId);
        if (idx === -1) return prev;
        const replacement = data.replacement_task ?? null;
        if (replacement) {
          const next = [...prev.tasks];
          next[idx] = replacement;
          return { ...prev, tasks: next, session_id: data.session_id || prev.session_id };
        }
        return {
          ...prev,
          tasks: prev.tasks.filter((t) => t.task_id !== taskId),
          session_id: data.session_id || prev.session_id,
        };
      });
    } catch (e) {
      setError(String(e));
    }
  }

  return (
    <div className="page">
      <div className="topbar">
        <div className="brand">
          <h1>Housepage</h1>
          <span className="badge">v0</span>
        </div>
        <div className="tabs">
          <button
            type="button"
            onClick={() => setMode("flow")}
            className={`btn ${mode === "flow" ? "btnSelected btnPrimary" : "btnGhost"}`}
          >
            Flow
          </button>
          <button
            type="button"
            onClick={() => setMode("library")}
            className={`btn ${mode === "library" ? "btnSelected btnPrimary" : "btnGhost"}`}
          >
            Library
          </button>
          <button
            type="button"
            onClick={() => setMode("metrics")}
            className={`btn ${mode === "metrics" ? "btnSelected btnPrimary" : "btnGhost"}`}
          >
            Metrics
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {!settings && !error && <div className="card">Loading…</div>}

      {mode === "flow" && settings && (
        <div className="card">
          {!selectedRoom && (
            <>
              <h2 className="sectionTitle">Rooms</h2>
              <ul className="list">
                {settings.rooms.map((room) => (
                  <li key={room.id} className="item">
                    <div className="row">
                      <button type="button" onClick={() => setSelectedRoom(room)} className="btn btnPrimary">
                        {room.label}
                      </button>
                      <span className="meta">{room.id}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {selectedRoom && (
            <>
              <button
                type="button"
                onClick={() => setSelectedRoom(null)}
                className="btn btnGhost"
              >
                Back
              </button>

              {!scanSubmitted && (
                <>
                  <h2 className="sectionTitle">Scan: {selectedRoom.label}</h2>
                  {!checks && !error && <div className="subtle">Loading checks…</div>}
                  {checks && (
                    <ul className="list">
                      {checks.checks.map((check) => (
                        <li key={check.id} className="item">
                          <div>{check.prompt}</div>
                          <div className="row" style={{ marginTop: 8 }}>
                            <button
                              type="button"
                              onClick={() => setAnswers((a) => ({ ...a, [check.id]: "yes" }))}
                              className={`btn ${answers[check.id] === "yes" ? "btnSelected" : ""}`}
                            >
                              Yes
                            </button>{" "}
                            <button
                              type="button"
                              onClick={() => setAnswers((a) => ({ ...a, [check.id]: "no" }))}
                              className={`btn ${answers[check.id] === "no" ? "btnSelected" : ""}`}
                            >
                              No
                            </button>
                          </div>
                          <div className="meta">{check.id}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {checks && (
                    <button
                      type="button"
                      disabled={!canSubmitScan}
                      onClick={submitScan}
                      className="btn btnPrimary"
                      style={{ marginTop: 10 }}
                    >
                      Finish scan
                    </button>
                  )}
                </>
              )}

              {scanSubmitted && settings && (
                <>
                  <h2 className="sectionTitle">Energy + Time</h2>
                  <div className="meta" style={{ marginTop: 0 }}>
                    Session: <code>{scanSubmitted.session_id}</code>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="dividerTitle">ENERGY (1–5)</div>
                    <div className="row">
                      {[1, 2, 3, 4, 5].map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => setEnergy(e)}
                          className={`btn ${energy === e ? "btnSelected" : ""}`}
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginTop: 14 }}>
                    <div className="dividerTitle">TIME AVAILABLE (MINUTES)</div>
                    <div className="row">
                      {settings.defaults.time_buckets_min.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setTimeMin(t)}
                          className={`btn ${timeMin === t ? "btnSelected" : ""}`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={!canDeal}
                    className="btn btnPrimary"
                    style={{ marginTop: 16 }}
                    onClick={dealTasks}
                  >
                    Deal tasks
                  </button>

                  {dealt && (
                    <>
                      <h2 className="sectionTitle" style={{ marginTop: 22 }}>
                        Task hand
                      </h2>
                      {dealt.tasks.length === 0 && <div className="subtle">No eligible tasks.</div>}
                      {dealt.tasks.length > 0 && (
                        <ul className="list">
                          {dealt.tasks.map((task) => (
                            <li key={task.task_id} className="item">
                              <div>
                                {task.title}{" "}
                                <span className="subtle">
                                  ({task.minutes_est} min, effort {task.effort})
                                </span>
                              </div>
                              <div className="meta">
                                {task.task_id} · room {task.room} · score {task.score}
                              </div>
                              <div className="row" style={{ marginTop: 10 }}>
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => actOnTask(task.task_id, "done")}
                                >
                                  Done
                                </button>{" "}
                                <button
                                  type="button"
                                  className="btn"
                                  onClick={() => actOnTask(task.task_id, "skip")}
                                >
                                  Skip
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {mode === "library" && settings && (
        <div className="card">
          <h2 className="sectionTitle">Library</h2>
          <div className="meta">
            Device: <code>{deviceId}</code>
          </div>
          <div className="meta" style={{ marginTop: 6 }}>
            Source files (in vault): <code>tasks.json</code>, <code>checks.json</code>, <code>settings.json</code>
          </div>

          <div className="row" style={{ marginTop: 14 }}>
            <button
              type="button"
              onClick={() => setLibraryTab("tasks")}
              className={`btn ${libraryTab === "tasks" ? "btnSelected btnPrimary" : "btnGhost"}`}
            >
              Tasks
            </button>
            <button
              type="button"
              onClick={() => setLibraryTab("checks")}
              className={`btn ${libraryTab === "checks" ? "btnSelected btnPrimary" : "btnGhost"}`}
            >
              Checks
            </button>
            <button type="button" onClick={refreshLibrary} className="btn">
              Refresh
            </button>
          </div>

          {!defsHashes && <div className="subtle" style={{ marginTop: 12 }}>Loading definitions…</div>}

          {libraryTab === "tasks" && defsHashes && allTasks && (
            <>
              <div className="meta" style={{ marginTop: 12 }}>
                tasks sha: <code>{defsHashes.tasks_sha256.slice(0, 12)}…</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText("tasks.json")}
                  className="btn"
                  style={{ padding: "4px 10px", marginLeft: 8 }}
                >
                  Copy path
                </button>
              </div>

              {!taskForm && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const firstRoom = settings.rooms[0]?.id ?? "kitchen";
                      setTaskForm({
                        id: "",
                        title: "",
                        room: firstRoom,
                        effort: 2,
                        minutes_est: 5,
                        frequency_days: null,
                        kind: "tidy",
                        notes: null,
                      });
                      setEditingTaskId(null);
                    }}
                    className="btn btnPrimary"
                    style={{ marginTop: 10 }}
                  >
                    New task
                  </button>
                  {taskGroupOrder.map((group) => {
                    const tasksInGroup = allTasks.filter((t) => t.room === group.roomId);
                    if (tasksInGroup.length === 0) return null;
                    return (
                      <div key={group.roomId} style={{ marginTop: 14 }}>
                        <div className="dividerTitle">{group.label}</div>
                        <ul className="list">
                          {tasksInGroup.map((t) => (
                            <li key={t.id} className="item">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(t.id);
                                  setTaskForm({
                                    id: t.id,
                                    title: t.title,
                                    room: t.room,
                                    effort: t.effort,
                                    minutes_est: t.minutes_est,
                                    frequency_days: t.frequency_days ?? null,
                                    kind: t.kind,
                                    notes: t.notes ?? null,
                                  });
                                }}
                                className="btn"
                              >
                                Edit
                              </button>{" "}
                              {t.title} <span style={{ opacity: 0.6 }}>({t.id})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {allTasks.filter((t) => !taskGroupOrder.some((g) => g.roomId === t.room)).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="dividerTitle">OTHER</div>
                      <ul className="list">
                        {allTasks
                          .filter((t) => !taskGroupOrder.some((g) => g.roomId === t.room))
                          .map((t) => (
                            <li key={t.id} className="item">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTaskId(t.id);
                                  setTaskForm({
                                    id: t.id,
                                    title: t.title,
                                    room: t.room,
                                    effort: t.effort,
                                    minutes_est: t.minutes_est,
                                    frequency_days: t.frequency_days ?? null,
                                    kind: t.kind,
                                    notes: t.notes ?? null,
                                  });
                                }}
                                className="btn"
                              >
                                Edit
                              </button>{" "}
                              {t.title} <span style={{ opacity: 0.6 }}>({t.id})</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {taskForm && (
                <>
                  <h3 className="sectionTitle">{editingTaskId ? "Edit task" : "New task"}</h3>
                  <div className="form">
                    <label>
                      id
                      <input
                        value={taskForm.id}
                        onChange={(e) => setTaskForm({ ...taskForm, id: e.target.value })}
                        disabled={!!editingTaskId}
                      />
                    </label>
                    <label>
                      title
                      <input
                        value={taskForm.title}
                        onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                      />
                    </label>
                    <label>
                      room
                      <select
                        value={taskForm.room}
                        onChange={(e) => setTaskForm({ ...taskForm, room: e.target.value })}
                      >
                        {settings.rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      effort (1–5)
                      <input
                        type="number"
                        min={1}
                        max={5}
                        value={taskForm.effort}
                        onChange={(e) => setTaskForm({ ...taskForm, effort: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      minutes_est
                      <input
                        type="number"
                        min={1}
                        value={taskForm.minutes_est}
                        onChange={(e) => setTaskForm({ ...taskForm, minutes_est: Number(e.target.value) })}
                      />
                    </label>
                    <label>
                      frequency_days (blank = none)
                      <input
                        type="number"
                        min={1}
                        value={taskForm.frequency_days ?? ""}
                        onChange={(e) =>
                          setTaskForm({
                            ...taskForm,
                            frequency_days: e.target.value ? Number(e.target.value) : null,
                          })
                        }
                      />
                    </label>
                    <label>
                      kind
                      <input
                        value={taskForm.kind}
                        onChange={(e) => setTaskForm({ ...taskForm, kind: e.target.value })}
                      />
                    </label>
                    <label>
                      notes (optional)
                      <input
                        value={taskForm.notes ?? ""}
                        onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value || null })}
                      />
                    </label>
                  </div>

                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!defsHashes) return;
                        if (!taskForm.id || !taskForm.title) {
                          setError("Task requires id and title.");
                          return;
                        }
                        setError(null);
                        const payload = {
                          task: taskForm,
                          if_match_sha256: defsHashes.tasks_sha256,
                        };
                        const resp = await fetch("/api/tasks/upsert", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        const data = await resp.json();
                        if (!resp.ok) {
                          setError(JSON.stringify(data));
                          return;
                        }
                        setTaskForm(null);
                        setEditingTaskId(null);
                        await refreshLibrary();
                      }}
                      className="btn btnPrimary"
                    >
                      Save
                    </button>
                    {editingTaskId && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!defsHashes || !editingTaskId) return;
                          setError(null);
                          const payload = {
                            task_id: editingTaskId,
                            if_match_sha256: defsHashes.tasks_sha256,
                          };
                          const resp = await fetch("/api/tasks/delete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          const data = await resp.json();
                          if (!resp.ok) {
                            setError(JSON.stringify(data));
                            return;
                          }
                          setTaskForm(null);
                          setEditingTaskId(null);
                          await refreshLibrary();
                        }}
                        className="btn btnDanger"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setTaskForm(null);
                        setEditingTaskId(null);
                      }}
                      className="btn"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {libraryTab === "checks" && defsHashes && allChecks && allTasks && (
            <>
              <div className="meta" style={{ marginTop: 12 }}>
                checks sha: <code>{defsHashes.checks_sha256.slice(0, 12)}…</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText("checks.json")}
                  className="btn"
                  style={{ padding: "4px 10px", marginLeft: 8 }}
                >
                  Copy path
                </button>
              </div>

              {!checkForm && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const firstRoom = settings.rooms[0]?.id ?? "kitchen";
                      setCheckForm({
                        id: "",
                        room: firstRoom,
                        prompt: "",
                        linked_task_ids: [],
                        notes: null,
                      });
                      setEditingCheckId(null);
                    }}
                    className="btn btnPrimary"
                    style={{ marginTop: 10 }}
                  >
                    New check
                  </button>
                  {taskGroupOrder.map((group) => {
                    const checksInGroup = allChecks.filter((c) => c.room === group.roomId);
                    if (checksInGroup.length === 0) return null;
                    return (
                      <div key={group.roomId} style={{ marginTop: 14 }}>
                        <div className="dividerTitle">{group.label}</div>
                        <ul className="list">
                          {checksInGroup.map((c) => (
                            <li key={c.id} className="item">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCheckId(c.id);
                                  setCheckForm({
                                    id: c.id,
                                    room: c.room,
                                    prompt: c.prompt,
                                    linked_task_ids: c.linked_task_ids ?? [],
                                    notes: c.notes ?? null,
                                  });
                                }}
                                className="btn"
                              >
                                Edit
                              </button>{" "}
                              {c.prompt} <span style={{ opacity: 0.6 }}>({c.id})</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}

                  {allChecks.filter((c) => !taskGroupOrder.some((g) => g.roomId === c.room)).length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div className="dividerTitle">OTHER</div>
                      <ul className="list">
                        {allChecks
                          .filter((c) => !taskGroupOrder.some((g) => g.roomId === c.room))
                          .map((c) => (
                            <li key={c.id} className="item">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCheckId(c.id);
                                  setCheckForm({
                                    id: c.id,
                                    room: c.room,
                                    prompt: c.prompt,
                                    linked_task_ids: c.linked_task_ids ?? [],
                                    notes: c.notes ?? null,
                                  });
                                }}
                                className="btn"
                              >
                                Edit
                              </button>{" "}
                              {c.prompt} <span style={{ opacity: 0.6 }}>({c.id})</span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}

              {checkForm && (
                <>
                  <h3 className="sectionTitle">{editingCheckId ? "Edit check" : "New check"}</h3>
                  <div className="form">
                    <label>
                      id
                      <input
                        value={checkForm.id}
                        onChange={(e) => setCheckForm({ ...checkForm, id: e.target.value })}
                        disabled={!!editingCheckId}
                      />
                    </label>
                    <label>
                      room
                      <select
                        value={checkForm.room}
                        onChange={(e) => setCheckForm({ ...checkForm, room: e.target.value })}
                      >
                        {settings.rooms.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      prompt
                      <input
                        value={checkForm.prompt}
                        onChange={(e) => setCheckForm({ ...checkForm, prompt: e.target.value })}
                      />
                    </label>
                    <label>
                      linked tasks
                      <select
                        multiple
                        value={checkForm.linked_task_ids}
                        onChange={(e) => {
                          const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                          setCheckForm({ ...checkForm, linked_task_ids: selected });
                        }}
                      >
                        {allTasks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title} ({t.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      notes (optional)
                      <input
                        value={checkForm.notes ?? ""}
                        onChange={(e) => setCheckForm({ ...checkForm, notes: e.target.value || null })}
                      />
                    </label>
                  </div>

                  <div className="row" style={{ marginTop: 12 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        if (!defsHashes) return;
                        if (!checkForm.id || !checkForm.prompt) {
                          setError("Check requires id and prompt.");
                          return;
                        }
                        setError(null);
                        const payload = {
                          check: checkForm,
                          if_match_sha256: defsHashes.checks_sha256,
                        };
                        const resp = await fetch("/api/checks/upsert", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify(payload),
                        });
                        const data = await resp.json();
                        if (!resp.ok) {
                          setError(JSON.stringify(data));
                          return;
                        }
                        setCheckForm(null);
                        setEditingCheckId(null);
                        await refreshLibrary();
                      }}
                      className="btn btnPrimary"
                    >
                      Save
                    </button>
                    {editingCheckId && (
                      <button
                        type="button"
                        onClick={async () => {
                          if (!defsHashes || !editingCheckId) return;
                          setError(null);
                          const payload = {
                            check_id: editingCheckId,
                            if_match_sha256: defsHashes.checks_sha256,
                          };
                          const resp = await fetch("/api/checks/delete", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify(payload),
                          });
                          const data = await resp.json();
                          if (!resp.ok) {
                            setError(JSON.stringify(data));
                            return;
                          }
                          setCheckForm(null);
                          setEditingCheckId(null);
                          await refreshLibrary();
                        }}
                        className="btn btnDanger"
                      >
                        Delete
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setCheckForm(null);
                        setEditingCheckId(null);
                      }}
                      className="btn"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {mode === "metrics" && settings && (
        <div className="card">
          <h2 className="sectionTitle">Metrics</h2>
          <div className="subtle">Computed from `events.ndjson` (reloads on request).</div>

          <div className="row" style={{ marginTop: 12, gap: 8, flexWrap: "wrap" }}>
            <span className="meta">Window</span>
            {[7, 14, 30, 90].map((d) => (
              <button
                key={d}
                type="button"
                className={`btn ${metricsDays === d ? "btnSelected btnPrimary" : "btnGhost"}`}
                onClick={() => {
                  setMetricsDays(d);
                  refreshMetrics(d);
                }}
              >
                {d}d
              </button>
            ))}
            <button type="button" className="btn btnGhost" onClick={() => refreshMetrics()}>
              Refresh
            </button>
          </div>

          {!metrics && !error && <div className="subtle" style={{ marginTop: 12 }}>Loading…</div>}

          {metrics && (
            <>
              <div className="row" style={{ marginTop: 12, gap: 12, flexWrap: "wrap" }}>
                <div className="pill">Tasks done: {metrics.tasks_done_total}</div>
                <div className="pill">Checks “no”: {metrics.checks_no_total}</div>
                <div className="pill">Deals: {metrics.deals_total}</div>
                <div className="pill">
                  Avg time bucket: {metrics.time_bucket_avg ? `${Math.round(metrics.time_bucket_avg)} min` : "—"}
                </div>
              </div>

              <h3 className="sectionTitle" style={{ marginTop: 18 }}>Tasks done by room</h3>
              {metrics.tasks_done_by_room.length === 0 && <div className="subtle">No data in this window.</div>}
              {metrics.tasks_done_by_room.length > 0 && (
                <ul className="list">
                  {metrics.tasks_done_by_room.map((r) => (
                    <li key={r.room} className="item">
                      <div className="row">
                        <span>{r.room}</span>
                        <span className="meta">{r.count}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="sectionTitle" style={{ marginTop: 18 }}>Top tasks done</h3>
              {metrics.tasks_done_top.length === 0 && <div className="subtle">No data in this window.</div>}
              {metrics.tasks_done_top.length > 0 && (
                <ul className="list">
                  {metrics.tasks_done_top.map((t) => (
                    <li key={t.task_id} className="item">
                      <div className="row">
                        <span>{t.title ?? t.task_id}</span>
                        <span className="meta">{t.count}</span>
                      </div>
                      <div className="subtle">{t.room ?? "unknown"} · {t.task_id}</div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="sectionTitle" style={{ marginTop: 18 }}>Checks “no” by room</h3>
              {metrics.checks_no_by_room.length === 0 && <div className="subtle">No “no” answers in this window.</div>}
              {metrics.checks_no_by_room.length > 0 && (
                <ul className="list">
                  {metrics.checks_no_by_room.map((r) => (
                    <li key={r.room} className="item">
                      <div className="row">
                        <span>{r.room}</span>
                        <span className="meta">{r.count}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="sectionTitle" style={{ marginTop: 18 }}>Top checks “no”</h3>
              {metrics.checks_no_top.length === 0 && <div className="subtle">No “no” answers in this window.</div>}
              {metrics.checks_no_top.length > 0 && (
                <ul className="list">
                  {metrics.checks_no_top.map((c) => (
                    <li key={c.check_id} className="item">
                      <div className="row">
                        <span>{c.prompt ?? c.check_id}</span>
                        <span className="meta">{c.count}</span>
                      </div>
                      <div className="subtle">{c.room ?? "unknown"} · {c.check_id}</div>
                    </li>
                  ))}
                </ul>
              )}

              <h3 className="sectionTitle" style={{ marginTop: 18 }}>Time bucket distribution</h3>
              {metrics.time_bucket_counts.length === 0 && <div className="subtle">No deals in this window.</div>}
              {metrics.time_bucket_counts.length > 0 && (
                <ul className="list">
                  {metrics.time_bucket_counts.map((b) => (
                    <li key={b.time_min} className="item">
                      <div className="row">
                        <span>{b.time_min} min</span>
                        <span className="meta">{b.count}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
