import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
const prisma = new PrismaClient({ adapter });

async function main() {
    console.log('=== Housepage Smoke Test ===\n');

    // 1. Connection
    console.log('1. Connecting to database...');
    await prisma.$connect();
    console.log('   OK: Connected\n');

    // 2. Create a user
    console.log('2. Creating test user...');
    const user = await prisma.user.upsert({
        where: { email: 'smoke-test@housepage.local' },
        update: {},
        create: {
            email: 'smoke-test@housepage.local',
            name: 'smoke-test',
        },
    });
    console.log(`   OK: User ${user.id} (${user.email})\n`);

    // 3. Create a household
    console.log('3. Creating test household...');
    const household = await prisma.household.create({
        data: { name: 'Smoke Test Household' },
    });
    console.log(`   OK: Household ${household.id} (${household.name})\n`);

    // 4. Create a membership
    console.log('4. Creating membership (OWNER)...');
    const membership = await prisma.membership.create({
        data: {
            userId: user.id,
            householdId: household.id,
            role: 'OWNER',
        },
    });
    console.log(`   OK: Membership ${membership.id} (role: ${membership.role})\n`);

    // 5. Create operational objects
    console.log('5. Creating sample objects...');

    const task = await prisma.task.create({
        data: {
            title: 'Test chore',
            householdId: household.id,
            assigneeId: user.id,
            status: 'OPEN',
        },
    });
    console.log(`   Task: ${task.id} (${task.title})`);

    const expense = await prisma.expense.create({
        data: {
            title: 'Test expense',
            amount: 42.00,
            householdId: household.id,
            payerId: user.id,
        },
    });
    console.log(`   Expense: ${expense.id} (${expense.title})`);

    const note = await prisma.note.create({
        data: {
            title: 'Test note',
            content: 'This is a test note.',
            category: 'General',
            householdId: household.id,
        },
    });
    console.log(`   Note: ${note.id} (${note.title})`);

    const decision = await prisma.decision.create({
        data: {
            title: 'Test decision',
            context: 'Test context',
            householdId: household.id,
            createdBy: user.id,
            status: 'PROPOSED',
        },
    });
    console.log(`   Decision: ${decision.id} (${decision.title})`);

    const feedEvent = await prisma.feedEvent.create({
        data: {
            type: 'chore',
            action: 'smoke test event',
            userId: user.id,
            householdId: household.id,
        },
    });
    console.log(`   FeedEvent: ${feedEvent.id}\n`);

    // 6. Verify membership isolation
    console.log('6. Verifying membership query...');
    const memberships = await prisma.membership.findMany({
        where: { userId: user.id },
        include: { household: true },
    });
    console.log(`   OK: User has ${memberships.length} membership(s)\n`);

    console.log('=== ALL SMOKE TESTS PASSED ===');

    // Cleanup
    console.log('\nCleaning up test data...');
    await prisma.feedEvent.deleteMany({ where: { householdId: household.id } });
    await prisma.decision.deleteMany({ where: { householdId: household.id } });
    await prisma.note.deleteMany({ where: { householdId: household.id } });
    await prisma.expense.deleteMany({ where: { householdId: household.id } });
    await prisma.task.deleteMany({ where: { householdId: household.id } });
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.household.deleteMany({ where: { id: household.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    console.log('Cleanup complete.');
}

main()
    .catch((e) => {
        console.error('SMOKE TEST FAILED:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
