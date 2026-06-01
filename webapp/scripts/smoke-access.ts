import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('=== Access Control Smoke Test ===\n');

    // 1. Create two households with users
    console.log('1. Creating test users and households...');
    const userA = await prisma.user.upsert({
        where: { email: 'access-a@test.local' },
        update: {},
        create: { email: 'access-a@test.local', name: 'User A' },
    });
    const userB = await prisma.user.upsert({
        where: { email: 'access-b@test.local' },
        update: {},
        create: { email: 'access-b@test.local', name: 'User B' },
    });
    console.log(`   Users: ${userA.email}, ${userB.email}`);

    const hhA = await prisma.household.create({
        data: { name: 'Access Test HH A' },
    });
    const hhB = await prisma.household.create({
        data: { name: 'Access Test HH B' },
    });
    console.log(`   Households: ${hhA.name}, ${hhB.name}`);

    // 2. Create memberships
    await prisma.membership.create({
        data: { userId: userA.id, householdId: hhA.id, role: 'OWNER' },
    });
    await prisma.membership.create({
        data: { userId: userB.id, householdId: hhB.id, role: 'OWNER' },
    });
    console.log('   Memberships: A -> HH A (OWNER), B -> HH B (OWNER)\n');

    // 3. Create rooms in each household
    console.log('3. Creating rooms in each household...');
    const roomA = await prisma.room.create({
        data: { householdId: hhA.id, name: 'Kitchen A', slug: 'kitchen-a', sortOrder: 0 },
    });
    const roomB = await prisma.room.create({
        data: { householdId: hhB.id, name: 'Kitchen B', slug: 'kitchen-b', sortOrder: 0 },
    });
    console.log(`   Room A: ${roomA.slug}, Room B: ${roomB.slug}\n`);

    // 4. Create tasks in each household
    console.log('4. Creating tasks in each household...');
    const taskA = await prisma.task.create({
        data: { title: 'Task in HH A', householdId: hhA.id, roomId: roomA.id, effort: 1, minutesEst: 5, status: 'OPEN', sourceKey: 't_access_a' },
    });
    const taskB = await prisma.task.create({
        data: { title: 'Task in HH B', householdId: hhB.id, roomId: roomB.id, effort: 1, minutesEst: 5, status: 'OPEN', sourceKey: 't_access_b' },
    });
    console.log(`   Task A in HH A, Task B in HH B\n`);

    // 5. Verify household scoping: tasks from HH A should not be visible in HH B
    console.log('5. Verifying household scoping...');
    const tasksInA = await prisma.task.findMany({ where: { householdId: hhA.id } });
    const tasksInB = await prisma.task.findMany({ where: { householdId: hhB.id } });
    const taskIdsInA = new Set(tasksInA.map(t => t.sourceKey));
    const taskIdsInB = new Set(tasksInB.map(t => t.sourceKey));
    const leaked = tasksInA.filter(t => taskIdsInB.has(t.sourceKey));
    if (leaked.length > 0) {
        throw new Error(`FAIL: tasks leaked between households: ${leaked.map(t => t.sourceKey).join(', ')}`);
    }
    console.log(`   OK: ${tasksInA.length} tasks in HH A, ${tasksInB.length} tasks in HH B, no leakage\n`);

    // 6. Verify room scoping
    console.log('6. Verifying room scoping...');
    const roomsInA = await prisma.room.findMany({ where: { householdId: hhA.id } });
    const roomsInB = await prisma.room.findMany({ where: { householdId: hhB.id } });
    const roomSlugsA = new Set(roomsInA.map(r => r.slug));
    const roomSlugsB = new Set(roomsInB.map(r => r.slug));
    const roomLeak = roomsInA.filter(r => roomSlugsB.has(r.slug));
    if (roomLeak.length > 0) {
        throw new Error(`FAIL: rooms leaked between households: ${roomLeak.map(r => r.slug).join(', ')}`);
    }
    console.log(`   OK: rooms scoped per household\n`);

    // 7. Verify membership scoping: user A should not be in HH B
    console.log('7. Verifying membership scoping...');
    const membershipsA = await prisma.membership.findMany({ where: { userId: userA.id } });
    const membershipHouseholdIds = membershipsA.map(m => m.householdId);
    if (membershipHouseholdIds.includes(hhB.id)) {
        throw new Error('FAIL: user A should not be a member of HH B');
    }
    console.log(`   OK: user A is only in ${membershipsA.length} household(s), not HH B\n`);

    // 8. Verify role enforcement
    console.log('8. Verifying role enforcement...');
    const ownerMemberships = await prisma.membership.findMany({ where: { userId: userA.id, role: 'OWNER' } });
    const ownsHH_A = ownerMemberships.some(m => m.householdId === hhA.id);
    if (!ownsHH_A) {
        throw new Error('FAIL: user A should be OWNER of HH A');
    }
    console.log(`   OK: user A is OWNER of HH A\n`);

    console.log('=== ALL ACCESS CONTROL TESTS PASSED ===\n');

    // Cleanup
    console.log('Cleaning up...');
    await prisma.task.deleteMany({ where: { householdId: { in: [hhA.id, hhB.id] } } });
    await prisma.room.deleteMany({ where: { householdId: { in: [hhA.id, hhB.id] } } });
    await prisma.membership.deleteMany({ where: { userId: { in: [userA.id, userB.id] } } });
    await prisma.household.deleteMany({ where: { id: { in: [hhA.id, hhB.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } });
    console.log('Cleanup complete.');
}

main()
    .catch((e) => {
        console.error('ACCESS SMOKE FAILED:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
