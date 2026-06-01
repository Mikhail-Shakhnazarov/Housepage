import prisma from "./lib/prisma";

async function main() {
    console.log('=== Webapp General Smoke Test ===\n');

    // 1. Create user and household
    console.log('1. Creating test user and household...');
    const user = await prisma.user.upsert({
        where: { email: 'webapp-smoke@test.local' },
        update: {},
        create: { email: 'webapp-smoke@test.local', name: 'Webapp Smoke' },
    });
    const household = await prisma.household.create({
        data: { name: 'Webapp Smoke HH' },
    });
    await prisma.membership.create({
        data: { userId: user.id, householdId: household.id, role: 'OWNER' },
    });
    console.log(`   User: ${user.email}, Household: ${household.name}\n`);

    // 2. Create notes
    console.log('2. Creating notes...');
    const note1 = await prisma.note.create({
        data: {
            householdId: household.id,
            title: 'Wi-Fi Password',
            content: 'SSID: WG-Net\nPassword: secret123',
            category: 'Access',
            pinned: true,
        },
    });
    const note2 = await prisma.note.create({
        data: {
            householdId: household.id,
            title: 'Heating Schedule',
            content: 'Winter: 20°C day, 17°C night',
            category: 'Utilities',
            pinned: false,
        },
    });
    console.log(`   Notes: ${note1.title}, ${note2.title}\n`);

    // 3. Create expenses with splits
    console.log('3. Creating expenses...');
    const expense1 = await prisma.expense.create({
        data: {
            householdId: household.id,
            title: 'Internet Bill',
            amount: 39.99,
            currency: 'EUR',
            payerId: user.id,
            splits: {
                create: [
                    { userId: user.id, amount: 20.00 },
                ],
            },
        },
    });
    const expense2 = await prisma.expense.create({
        data: {
            householdId: household.id,
            title: 'Cleaning Supplies',
            amount: 15.50,
            currency: 'EUR',
            payerId: user.id,
            splits: {
                create: [
                    { userId: user.id, amount: 15.50 },
                ],
            },
        },
    });
    console.log(`   Expenses: ${expense1.title} (€${expense1.amount}), ${expense2.title} (€${expense2.amount})\n`);

    // 4. Create decisions
    console.log('4. Creating decisions...');
    const decision1 = await prisma.decision.create({
        data: {
            householdId: household.id,
            title: 'Monthly cleaning roster',
            context: 'Rotate kitchen duty weekly',
            status: 'AGREED',
            createdBy: user.id,
        },
    });
    const decision2 = await prisma.decision.create({
        data: {
            householdId: household.id,
            title: 'Raise internet contribution',
            context: 'From €10 to €12 per person',
            status: 'PROPOSED',
            createdBy: user.id,
        },
    });
    console.log(`   Decisions: ${decision1.title} (${decision1.status}), ${decision2.title} (${decision2.status})\n`);

    // 5. Create feed events
    console.log('5. Creating feed events...');
    await prisma.feedEvent.createMany({
        data: [
            { type: 'money', action: 'Paid internet €39.99', userId: user.id, householdId: household.id },
            { type: 'decision', action: 'Cleaning roster AGREED', userId: user.id, householdId: household.id },
            { type: 'note', action: 'Added Wi-Fi password note', userId: user.id, householdId: household.id },
        ],
    });
    console.log('   Feed events: 3 created\n');

    // 6. Verify read-back
    console.log('6. Verifying read-back...');
    const notes = await prisma.note.findMany({ where: { householdId: household.id } });
    const expenses = await prisma.expense.findMany({ where: { householdId: household.id }, include: { splits: true } });
    const decisions = await prisma.decision.findMany({ where: { householdId: household.id } });
    const feed = await prisma.feedEvent.findMany({ where: { householdId: household.id } });
    console.log(`   Notes: ${notes.length}`);
    console.log(`   Expenses: ${expenses.length} (with ${expenses.reduce((s, e) => s + e.splits.length, 0)} splits)`);
    console.log(`   Decisions: ${decisions.length}`);
    console.log(`   Feed events: ${feed.length}\n`);

    // 7. Verify correctness
    console.log('7. Verifying correctness...');
    if (notes.length < 2) throw new Error('FAIL: expected at least 2 notes');
    if (expenses.length < 2) throw new Error('FAIL: expected at least 2 expenses');
    if (decisions.length < 2) throw new Error('FAIL: expected at least 2 decisions');
    if (feed.length < 3) throw new Error('FAIL: expected at least 3 feed events');
    if (!notes.some(n => n.pinned)) throw new Error('FAIL: expected at least one pinned note');
    if (!decisions.some(d => d.status === 'AGREED')) throw new Error('FAIL: expected AGREED decision');
    if (!decisions.some(d => d.status === 'PROPOSED')) throw new Error('FAIL: expected PROPOSED decision');
    console.log('   OK: All counts and statuses verified\n');

    console.log('=== ALL WEBAPP SMOKE TESTS PASSED ===\n');

    // Cleanup
    console.log('Cleaning up...');
    await prisma.feedEvent.deleteMany({ where: { householdId: household.id } });
    await prisma.note.deleteMany({ where: { householdId: household.id } });
    await prisma.decision.deleteMany({ where: { householdId: household.id } });
    await prisma.expenseSplit.deleteMany({ where: { expense: { householdId: household.id } } });
    await prisma.expense.deleteMany({ where: { householdId: household.id } });
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.household.deleteMany({ where: { id: household.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
    console.log('Cleanup complete.');
}

main()
    .catch((e) => {
        console.error('WEBAPP SMOKE FAILED:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
