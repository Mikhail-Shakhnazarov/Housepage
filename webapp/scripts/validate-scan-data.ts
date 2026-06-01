import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
const prisma = new PrismaClient({ adapter });

async function main() {
  const householdId = process.argv[2] || 'seed-sonnenallee-42';

  console.log(`=== Scan Data Validation for household ${householdId} ===\n`);

  const household = await prisma.household.findUnique({
    where: { id: householdId },
  });

  if (!household) {
    console.error(`Household ${householdId} not found`);
    process.exit(1);
  }

  // 1. Count rooms
  const roomCount = await prisma.room.count({
    where: { householdId },
  });
  if (roomCount === 0) {
    console.error('FAIL: no rooms found');
    process.exit(1);
  }
  console.log(`rooms: ${roomCount}`);

  // 2. Count tasks
  const taskCount = await prisma.task.count({
    where: { householdId },
  });
  if (taskCount === 0) {
    console.error('FAIL: no tasks found');
    process.exit(1);
  }
  console.log(`tasks: ${taskCount}`);

  // 3. Count checks
  const checkCount = await prisma.check.count({
    where: { householdId },
  });
  if (checkCount === 0) {
    console.error('FAIL: no checks found');
    process.exit(1);
  }
  console.log(`checks: ${checkCount}`);

  // 4. Count check-task links
  const linkCount = await prisma.checkTask.count({
    where: {
      check: { householdId },
    },
  });
  console.log(`check-task links: ${linkCount}`);

  // 5. Every check belongs to a room (roomId is required in schema, but validate FK)
  const checksWithInvalidRoom = await prisma.check.findMany({
    where: { householdId },
    include: { room: true },
  });
  const badCheckRooms = checksWithInvalidRoom.filter(c => !c.room);
  if (badCheckRooms.length > 0) {
    console.error(`FAIL: ${badCheckRooms.length} checks reference non-existent rooms`);
    process.exit(1);
  }

  // 6. Every check-task link points to existing rows
  const links = await prisma.checkTask.findMany({
    where: { check: { householdId } },
    include: { check: true, task: true },
  });
  const brokenLinks = links.filter(l => !l.check || !l.task);
  if (brokenLinks.length > 0) {
    console.error(`FAIL: ${brokenLinks.length} broken check-task links`);
    process.exit(1);
  }

  // 7. Every task with roomId points to an existing room
  const tasksWithRoom = await prisma.task.findMany({
    where: {
      householdId,
      roomId: { not: null },
    },
    include: { room: true },
  });
  const brokenTaskRooms = tasksWithRoom.filter(t => !t.room);
  if (brokenTaskRooms.length > 0) {
    console.error(`FAIL: ${brokenTaskRooms.length} tasks reference non-existent rooms`);
    process.exit(1);
  }

  // 8. Counts by room
  const rooms = await prisma.room.findMany({
    where: { householdId },
    include: {
      _count: { select: { checks: true, tasks: true } },
    },
    orderBy: { sortOrder: 'asc' },
  });
  console.log(`\ncounts by room:`);
  for (const r of rooms) {
    console.log(`  ${r.slug}: ${r._count.checks} checks, ${r._count.tasks} tasks`);
  }

  // Additional counts
  const sessionCount = await prisma.scanSession.count({
    where: { householdId },
  });
  const dealCount = await prisma.deal.count({
    where: { householdId },
  });
  const actionCount = await prisma.taskAction.count({
    where: { householdId },
  });

  if (sessionCount > 0) console.log(`\nscan sessions: ${sessionCount}`);
  if (dealCount > 0) console.log(`deals: ${dealCount}`);
  if (actionCount > 0) console.log(`task actions: ${actionCount}`);

  console.log('\nscan data ok');
}

main()
  .catch((e) => {
    console.error('Validation failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
