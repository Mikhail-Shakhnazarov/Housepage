import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
const prisma = new PrismaClient({ adapter });

const VAULT_DIR = join(__dirname, '..', '..', 'vault_sample', 'chore_system');

interface RoomDef {
  id: string;
  label: string;
}

interface Settings {
  rooms: RoomDef[];
}

interface TaskDef {
  id: string;
  title: string;
  room: string;
  effort: number;
  minutes_est: number;
  frequency_days: number | null;
  kind: string;
}

interface TasksFile {
  tasks: TaskDef[];
}

interface CheckDef {
  id: string;
  prompt: string;
  room: string;
  linked_task_ids: string[];
}

interface ChecksFile {
  checks: CheckDef[];
}

interface NdjsonEvent {
  type: string;
  session_id?: string;
  room?: string;
  check_id?: string;
  answer?: string;
  client_ts?: string;
  task_ids?: string[];
  energy?: number;
  time_min?: number;
  hand_size?: number;
  task_id?: string;
  action?: string;
}

function readJson<T>(relPath: string): T {
  const raw = readFileSync(join(VAULT_DIR, relPath), 'utf-8');
  return JSON.parse(raw);
}

function readNdjson(relPath: string): NdjsonEvent[] {
  const raw = readFileSync(join(VAULT_DIR, relPath), 'utf-8');
  return raw.split('\n').filter(l => l.trim()).map(l => JSON.parse(l));
}

async function main() {
  console.log('=== Scan Sample Seed ===\n');

  // 1. Read vault files
  const settings = readJson<Settings>('settings.json');
  const tasksFile = readJson<TasksFile>('tasks.json');
  const checksFile = readJson<ChecksFile>('checks.json');
  const events = readNdjson('events.ndjson');

  console.log(`Read ${settings.rooms.length} rooms, ${tasksFile.tasks.length} tasks, ${checksFile.checks.length} checks, ${events.length} events`);

  // 2. Find or create development user
  const user = await prisma.user.upsert({
    where: { email: 'alice@wg.local' },
    update: {},
    create: { email: 'alice@wg.local', name: 'Alice' },
  });
  console.log(`User: ${user.email} (${user.id})`);

  // 3. Find or create development household
  const household = await prisma.household.upsert({
    where: { id: 'seed-sonnenallee-42' },
    update: { name: 'Sonnenallee 42', address: 'Sonnenallee 42, 12047 Berlin' },
    create: {
      id: 'seed-sonnenallee-42',
      name: 'Sonnenallee 42',
      address: 'Sonnenallee 42, 12047 Berlin',
    },
  });
  console.log(`Household: ${household.name} (${household.id})`);

  // Ensure membership
  await prisma.membership.upsert({
    where: { userId_householdId: { userId: user.id, householdId: household.id } },
    update: { role: 'OWNER' },
    create: { userId: user.id, householdId: household.id, role: 'OWNER' },
  });

  // 4. Create or update rooms
  const roomMap = new Map<string, string>();
  for (const r of settings.rooms) {
    const room = await prisma.room.upsert({
      where: { householdId_slug: { householdId: household.id, slug: r.id } },
      update: { name: r.label, sortOrder: settings.rooms.indexOf(r) },
      create: {
        householdId: household.id,
        slug: r.id,
        name: r.label,
        sortOrder: settings.rooms.indexOf(r),
      },
    });
    roomMap.set(r.id, room.id);
  }
  console.log(`Rooms: ${roomMap.size} upserted`);

  // 5. Create or update tasks
  const taskMap = new Map<string, string>();
  for (const t of tasksFile.tasks) {
    const roomId = roomMap.get(t.room) ?? null;
    const task = await prisma.task.upsert({
      where: { householdId_sourceKey: { householdId: household.id, sourceKey: t.id } },
      update: {
        title: t.title,
        roomId,
        effort: t.effort,
        minutesEst: t.minutes_est,
        frequencyDays: t.frequency_days,
        kind: t.kind,
      },
      create: {
        title: t.title,
        householdId: household.id,
        roomId,
        effort: t.effort,
        minutesEst: t.minutes_est,
        frequencyDays: t.frequency_days,
        kind: t.kind,
        sourceKey: t.id,
        status: 'OPEN',
      },
    });
    taskMap.set(t.id, task.id);
  }
  console.log(`Tasks: ${taskMap.size} upserted`);

  // 6. Create or update checks
  const checkMap = new Map<string, string>();
  for (const c of checksFile.checks) {
    const roomId = roomMap.get(c.room);
    if (!roomId) {
      console.warn(`  Skipping check ${c.id}: room '${c.room}' not found`);
      continue;
    }
    const check = await prisma.check.upsert({
      where: { householdId_sourceKey: { householdId: household.id, sourceKey: c.id } },
      update: {
        prompt: c.prompt,
        roomId,
        notes: null,
      },
      create: {
        householdId: household.id,
        roomId,
        prompt: c.prompt,
        sourceKey: c.id,
        sortOrder: checksFile.checks.indexOf(c),
      },
    });
    checkMap.set(c.id, check.id);
  }
  console.log(`Checks: ${checkMap.size} upserted`);

  // 7. Create check-task links
  let linkCount = 0;
  for (const c of checksFile.checks) {
    const checkId = checkMap.get(c.id);
    if (!checkId) continue;
    for (const tid of c.linked_task_ids) {
      const taskId = taskMap.get(tid);
      if (!taskId) {
        console.warn(`  Skipping link: check ${c.id} -> task ${tid} not found`);
        continue;
      }
      await prisma.checkTask.upsert({
        where: { checkId_taskId: { checkId, taskId } },
        update: {},
        create: { checkId, taskId },
      });
      linkCount++;
    }
  }
  console.log(`Check-task links: ${linkCount} upserted`);

  // 8. Import historical events (optional - best effort)
  let sessionCount = 0;
  let dealCount = 0;
  let actionCount = 0;
  let answerCount = 0;

  const sessionMap = new Map<string, string>();

  for (const ev of events) {
    if (ev.type === 'scan_answer' && ev.session_id) {
      // Create or find session
      let sessionId = sessionMap.get(ev.session_id);
      if (!sessionId) {
        const roomId = ev.room ? roomMap.get(ev.room) : null;
        if (!roomId) continue;
        const session = await prisma.scanSession.upsert({
          where: { id: ev.session_id },
          update: {},
          create: {
            id: ev.session_id,
            householdId: household.id,
            roomId,
            clientTs: ev.client_ts ? new Date(ev.client_ts) : null,
          },
        });
        sessionMap.set(ev.session_id, session.id);
        sessionId = session.id;
        sessionCount++;
      }

      // Create scan answer
      const checkId = ev.check_id ? checkMap.get(ev.check_id) : null;
      if (!checkId) continue;

      await prisma.scanAnswer.create({
        data: {
          scanSessionId: sessionId,
          checkId,
          answer: ev.answer ?? 'yes',
        },
      });
      answerCount++;
    }

    if (ev.type === 'deal' && ev.session_id) {
      const roomId = ev.room ? roomMap.get(ev.room) : null;
      if (!roomId) continue;

      let sessionId = sessionMap.get(ev.session_id);
      if (!sessionId) {
        const session = await prisma.scanSession.upsert({
          where: { id: ev.session_id },
          update: {},
          create: {
            id: ev.session_id,
            householdId: household.id,
            roomId,
          },
        });
        sessionMap.set(ev.session_id, session.id);
        sessionId = session.id;
        sessionCount++;
      }

      const deal = await prisma.deal.create({
        data: {
          householdId: household.id,
          roomId,
          scanSessionId: sessionId,
          energy: ev.energy ?? 3,
          timeMin: ev.time_min ?? 30,
          handSize: ev.hand_size ?? 3,
        },
      });

      // Create deal-task links
      if (ev.task_ids) {
        for (let i = 0; i < ev.task_ids.length; i++) {
          const taskId = taskMap.get(ev.task_ids[i]);
          if (!taskId) continue;
          await prisma.dealTask.create({
            data: {
              dealId: deal.id,
              taskId,
              position: i,
            },
          });
        }
      }
      dealCount++;
    }

    if ((ev.type === 'task_done' || ev.type === 'task_skip') && ev.task_id) {
      const taskId = taskMap.get(ev.task_id);
      if (!taskId) continue;

      const action = ev.type === 'task_done' ? 'done' : 'skip';
      await prisma.taskAction.create({
        data: {
          householdId: household.id,
          taskId,
          action,
        },
      });
      actionCount++;
    }
  }

  console.log(`\nHistorical events imported:`);
  console.log(`  Scan sessions: ${sessionCount}`);
  console.log(`  Scan answers: ${answerCount}`);
  console.log(`  Deals: ${dealCount}`);
  console.log(`  Task actions: ${actionCount}`);

  console.log('\n=== Seed complete ===');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
