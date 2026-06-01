import prisma from "./lib/prisma";

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

    // 5. Create scan ontology objects
    console.log('5. Creating scan ontology objects...');

    const room = await prisma.room.create({
        data: {
            householdId: household.id,
            name: 'Kitchen',
            slug: 'kitchen',
            sortOrder: 0,
        },
    });
    console.log(`   Room: ${room.id} (${room.name})`);

    const task = await prisma.task.create({
        data: {
            title: 'Clean the sink',
            householdId: household.id,
            roomId: room.id,
            effort: 2,
            minutesEst: 10,
            status: 'OPEN',
            sourceKey: 't_kitchen_clean_sink',
        },
    });
    console.log(`   Task: ${task.id} (${task.title})`);

    const task2 = await prisma.task.create({
        data: {
            title: 'Empty the dishwasher',
            householdId: household.id,
            roomId: room.id,
            effort: 1,
            minutesEst: 7,
            status: 'OPEN',
            sourceKey: 't_kitchen_empty_dishwasher',
        },
    });
    console.log(`   Task: ${task2.id} (${task2.title})`);

    const check = await prisma.check.create({
        data: {
            householdId: household.id,
            roomId: room.id,
            prompt: 'Is the sink clean?',
            sourceKey: 'c_kitchen_sink_clean',
            active: true,
            sortOrder: 0,
        },
    });
    console.log(`   Check: ${check.id} (${check.prompt})`);

    const check2 = await prisma.check.create({
        data: {
            householdId: household.id,
            roomId: room.id,
            prompt: 'Is the dishwasher empty?',
            sourceKey: 'c_kitchen_dishwasher_empty',
            active: true,
            sortOrder: 1,
        },
    });
    console.log(`   Check: ${check2.id} (${check2.prompt})`);

    // Link check -> task
    await prisma.checkTask.create({
        data: { checkId: check.id, taskId: task.id },
    });
    await prisma.checkTask.create({
        data: { checkId: check2.id, taskId: task2.id },
    });
    console.log(`   Check-task links: 2 created\n`);

    // 6. Scan submission (simulates POST /api/scan/submit)
    console.log('6. Simulating scan submission...');
    const session = await prisma.scanSession.create({
        data: {
            householdId: household.id,
            roomId: room.id,
            userId: user.id,
        },
    });

    // Answer "no" to sink check (triggers task), "yes" to dishwasher
    await prisma.scanAnswer.create({
        data: { scanSessionId: session.id, checkId: check.id, answer: 'no' },
    });
    await prisma.scanAnswer.create({
        data: { scanSessionId: session.id, checkId: check2.id, answer: 'yes' },
    });

    await prisma.feedEvent.create({
        data: {
            type: 'scan',
            action: `scanned room kitchen: 2 checks answered`,
            userId: user.id,
            householdId: household.id,
        },
    });

    const answerCount = await prisma.scanAnswer.count({ where: { scanSessionId: session.id } });
    console.log(`   OK: Scan session ${session.id}, ${answerCount} answers written\n`);

    // 7. Deal (simulates POST /api/deal)
    console.log('7. Simulating deal creation...');

    // Find failed-check task IDs
    const failedAnswers = await prisma.scanAnswer.findMany({
        where: { scanSessionId: session.id, answer: 'no' },
        include: {
            check: {
                include: {
                    taskLinks: { select: { taskId: true } },
                },
            },
        },
    });
    const failedCheckTaskIds = new Set<string>();
    for (const ans of failedAnswers) {
        for (const link of ans.check.taskLinks) {
            failedCheckTaskIds.add(link.taskId);
        }
    }
    console.log(`   Failed check task IDs: ${[...failedCheckTaskIds].join(', ')}`);

    // Score and deal
    const tasks = await prisma.task.findMany({
        where: { householdId: household.id, roomId: room.id, archivedAt: null },
    });

    const scored = tasks.map((t) => {
        let score = 0;
        const reasons: string[] = [];
        if (failedCheckTaskIds.has(t.id)) { score += 10; reasons.push('failed scan link'); }
        if (t.effort !== null && t.effort <= 3) { score += 2; reasons.push('effort fits'); }
        if (t.minutesEst !== null && t.minutesEst <= 30) { score += 2; reasons.push('time fits'); }
        reasons.push('default');
        return { taskId: t.id, title: t.title, score, reason: reasons.join('; ') };
    });
    scored.sort((a, b) => b.score - a.score);
    const hand = scored.slice(0, 3);

    const deal = await prisma.deal.create({
        data: {
            householdId: household.id,
            roomId: room.id,
            scanSessionId: session.id,
            userId: user.id,
            energy: 3,
            timeMin: 30,
            handSize: 3,
        },
    });

    for (let i = 0; i < hand.length; i++) {
        await prisma.dealTask.create({
            data: {
                dealId: deal.id,
                taskId: hand[i].taskId,
                position: i,
                score: hand[i].score,
                reason: hand[i].reason,
            },
        });
    }

    await prisma.feedEvent.create({
        data: {
            type: 'deal',
            action: `dealt ${hand.length} tasks in kitchen (energy=3, time=30min)`,
            userId: user.id,
            householdId: household.id,
        },
    });

    console.log(`   OK: Deal ${deal.id}, ${hand.length} tasks dealt\n`);
    for (const t of hand) {
        console.log(`     - ${t.title} (score: ${t.score}, reason: ${t.reason})`);
    }
    console.log('');

    // 8. Task action: done (simulates POST /api/task/action)
    console.log('8. Simulating task done action...');
    const doneAction = await prisma.taskAction.create({
        data: {
            householdId: household.id,
            taskId: hand[0].taskId,
            roomId: room.id,
            dealId: deal.id,
            userId: user.id,
            action: 'done',
        },
    });
    await prisma.task.update({
        where: { id: hand[0].taskId },
        data: { status: 'DONE' },
    });
    await prisma.feedEvent.create({
        data: {
            type: 'task',
            action: `completed task: ${hand[0].title}`,
            userId: user.id,
            householdId: household.id,
        },
    });
    console.log(`   OK: TaskAction ${doneAction.id} (done)\n`);

    // 9. Task action: skip (simulates POST /api/task/action)
    console.log('9. Simulating task skip action...');
    const skipAction = await prisma.taskAction.create({
        data: {
            householdId: household.id,
            taskId: hand[1]?.taskId || hand[0].taskId,
            roomId: room.id,
            dealId: deal.id,
            userId: user.id,
            action: 'skip',
        },
    });
    await prisma.feedEvent.create({
        data: {
            type: 'task',
            action: `skipped task: ${hand[1]?.title || hand[0].title}`,
            userId: user.id,
            householdId: household.id,
        },
    });
    console.log(`   OK: TaskAction ${skipAction.id} (skip)\n`);

    // 10. Activity/feed verification
    console.log('10. Verifying activity feed...');
    const events = await prisma.feedEvent.findMany({
        where: { householdId: household.id },
        orderBy: { createdAt: 'desc' },
    });
    console.log(`   OK: ${events.length} feed events written`);
    for (const ev of events) {
        console.log(`     [${ev.type}] ${ev.action}`);
    }
    console.log('');

    // 11. Metrics verification
    console.log('11. Verifying metrics...');
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const metrics = {
        scanSessions: await prisma.scanSession.count({ where: { householdId: household.id, createdAt: { gte: since } } }),
        deals: await prisma.deal.count({ where: { householdId: household.id, createdAt: { gte: since } } }),
        doneActions: await prisma.taskAction.count({ where: { householdId: household.id, action: 'done', createdAt: { gte: since } } }),
        skipActions: await prisma.taskAction.count({ where: { householdId: household.id, action: 'skip', createdAt: { gte: since } } }),
    };
    console.log(`   OK: ${metrics.scanSessions} scans, ${metrics.deals} deals, ${metrics.doneActions} done, ${metrics.skipActions} skip\n`);

    console.log('=== ALL SMOKE TESTS PASSED ===\n');

    // Cleanup
    console.log('Cleaning up test data...');
    await prisma.feedEvent.deleteMany({ where: { householdId: household.id } });
    await prisma.taskAction.deleteMany({ where: { householdId: household.id } });
    await prisma.dealTask.deleteMany({ where: { deal: { householdId: household.id } } });
    await prisma.deal.deleteMany({ where: { householdId: household.id } });
    await prisma.scanAnswer.deleteMany({ where: { scanSession: { householdId: household.id } } });
    await prisma.scanSession.deleteMany({ where: { householdId: household.id } });
    await prisma.checkTask.deleteMany({ where: { check: { householdId: household.id } } });
    await prisma.check.deleteMany({ where: { householdId: household.id } });
    await prisma.task.deleteMany({ where: { householdId: household.id } });
    await prisma.room.deleteMany({ where: { householdId: household.id } });
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
