import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg(process.env["DATABASE_URL"]!);
const prisma = new PrismaClient({ adapter });

function daysFromNow(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d;
}

async function main() {
    console.log("Seeding synthetic household data...\n");

    // ── Users ──
    const alice = await prisma.user.upsert({
        where: { email: "alice@wg.local" },
        update: {},
        create: { email: "alice@wg.local", name: "Alice" },
    });
    const bob = await prisma.user.upsert({
        where: { email: "bob@wg.local" },
        update: {},
        create: { email: "bob@wg.local", name: "Bob" },
    });
    const clara = await prisma.user.upsert({
        where: { email: "clara@wg.local" },
        update: {},
        create: { email: "clara@wg.local", name: "Clara" },
    });
    const dave = await prisma.user.upsert({
        where: { email: "dave@wg.local" },
        update: {},
        create: { email: "dave@wg.local", name: "Dave" },
    });
    console.log(`Users: ${alice.name}, ${bob.name}, ${clara.name}, ${dave.name}`);

    // ── Household ──
    const household = await prisma.household.upsert({
        where: { id: "seed-sonnenallee-42" },
        update: { name: "Sonnenallee 42", address: "Sonnenallee 42, 12047 Berlin" },
        create: {
            id: "seed-sonnenallee-42",
            name: "Sonnenallee 42",
            address: "Sonnenallee 42, 12047 Berlin",
        },
    });
    console.log(`Household: ${household.name}`);

    // ── Memberships ──
    const members = [
        { user: alice, role: "OWNER" as const },
        { user: bob, role: "MEMBER" as const },
        { user: clara, role: "MEMBER" as const },
        { user: dave, role: "SUBLET" as const },
    ];
    for (const m of members) {
        await prisma.membership.upsert({
            where: { userId_householdId: { userId: m.user.id, householdId: household.id } },
            update: { role: m.role },
            create: { userId: m.user.id, householdId: household.id, role: m.role },
        });
    }
    console.log("Memberships: Alice (OWNER), Bob (MEMBER), Clara (MEMBER), Dave (SUBLET)");

    // ── Tasks ──
    const taskData = [
        { title: "Bio bins out — Wednesday pickup", status: "DUE", assigneeId: alice.id, dueDate: daysFromNow(1) },
        { title: "Deep-clean the kitchen", status: "OPEN", assigneeId: bob.id, dueDate: daysFromNow(5) },
        { title: "Mop hallway & stairs", status: "OPEN", assigneeId: null, dueDate: daysFromNow(3) },
        { title: "Buy toilet paper (everyone chips in)", status: "OVERDUE", assigneeId: clara.id, dueDate: daysFromNow(-2) },
        { title: "Take out yellow recycling bags", status: "DONE", assigneeId: dave.id, dueDate: daysFromNow(-1) },
        { title: "Clean bathroom — deep scrub", status: "OPEN", assigneeId: null, dueDate: daysFromNow(7) },
    ];
    await prisma.task.deleteMany({ where: { householdId: household.id } });
    for (const t of taskData) {
        await prisma.task.create({ data: { ...t, householdId: household.id } });
    }
    console.log(`Tasks: ${taskData.length} created`);

    // ── Expenses ──
    const expenseData = [
        {
            title: "Internet (Jan)",
            amount: 39.99,
            payerId: alice.id,
            splits: [
                { userId: alice.id, amount: 10.00 },
                { userId: bob.id, amount: 10.00 },
                { userId: clara.id, amount: 10.00 },
                { userId: dave.id, amount: 9.99 },
            ],
        },
        {
            title: "Cleaning supplies",
            amount: 24.50,
            payerId: bob.id,
            splits: [
                { userId: alice.id, amount: 6.13 },
                { userId: bob.id, amount: 6.13 },
                { userId: clara.id, amount: 6.12 },
                { userId: dave.id, amount: 6.12 },
            ],
        },
        {
            title: "Electricity bill (Q1)",
            amount: 185.00,
            payerId: clara.id,
            splits: [
                { userId: alice.id, amount: 61.67 },
                { userId: bob.id, amount: 61.67 },
                { userId: clara.id, amount: 61.66 },
            ],
        },
        {
            title: "Pizza night",
            amount: 42.00,
            payerId: dave.id,
            splits: [
                { userId: alice.id, amount: 10.50 },
                { userId: bob.id, amount: 10.50 },
                { userId: clara.id, amount: 10.50 },
                { userId: dave.id, amount: 10.50 },
            ],
        },
    ];
    await prisma.expense.deleteMany({ where: { householdId: household.id } });
    for (const e of expenseData) {
        const { splits, ...rest } = e;
        await prisma.expense.create({
            data: {
                ...rest,
                householdId: household.id,
                splits: { create: splits },
            },
        });
    }
    console.log(`Expenses: ${expenseData.length} created with splits`);

    // ── Notes ──
    const noteData = [
        {
            title: "Wi-Fi",
            content: "SSID: SonnenWG-5G\nPassword: flunder-katze-77\nRouter admin: http://fritz.box (admin/changeme)",
            category: "Access",
            pinned: true,
        },
        {
            title: "Heating schedule",
            content: "Radiator in hallway is finicky — set to nível 3, no higher.\nLiving room thermostat: 20°C day / 17°C night.",
            category: "Utilities",
            pinned: true,
        },
        {
            title: "Guest policy",
            content: "Max 3 consecutive nights without WG vote.\nNotify the group chat at least 24h in advance.",
            category: "Norms",
            pinned: false,
        },
        {
            title: "Door code",
            content: "Entry code: #8291#\nChange every 3 months (Alice handles it).",
            category: "Access",
            pinned: false,
        },
    ];
    await prisma.note.deleteMany({ where: { householdId: household.id } });
    for (const n of noteData) {
        await prisma.note.create({ data: { ...n, householdId: household.id } });
    }
    console.log(`Notes: ${noteData.length} created`);

    // ── Decisions ──
    const decisionData = [
        {
            title: "Adopt a monthly cleaning roster",
            context: "Kitchen has been messy. Bob proposed a fixed rotation: Alice (week 1), Bob (2), Clara (3), Dave (4).",
            status: "AGREED",
            createdBy: bob.id,
        },
        {
            title: "Raise internet contribution to €12/mo",
            context: "Provider increased the rate from €39.99 to €48. Still cheaper than everyone getting their own.",
            status: "PROPOSED",
            createdBy: alice.id,
        },
    ];
    await prisma.decision.deleteMany({ where: { householdId: household.id } });
    for (const d of decisionData) {
        await prisma.decision.create({ data: { ...d, householdId: household.id } });
    }
    console.log(`Decisions: ${decisionData.length} created`);

    // ── Feed Events ──
    const feedData = [
        { type: "chore", action: "Alice marked 'Bio bins out' as DUE", userId: alice.id },
        { type: "chore", action: "Clara added 'Buy toilet paper' overdue", userId: clara.id },
        { type: "money", action: "Bob paid €24.50 for cleaning supplies", userId: bob.id },
        { type: "money", action: "Clara paid €185.00 for electricity Q1", userId: clara.id },
        { type: "decision", action: "Monthly cleaning roster AGREED", userId: bob.id },
        { type: "manual", action: "Dave joined the WG!", userId: dave.id },
        { type: "chore", action: "Dave took out yellow recycling", userId: dave.id },
    ];
    await prisma.feedEvent.deleteMany({ where: { householdId: household.id } });
    for (const f of feedData) {
        await prisma.feedEvent.create({ data: { ...f, householdId: household.id } });
    }
    console.log(`Feed events: ${feedData.length} created`);

    console.log("\nSeed complete.");
    console.log("Sign in with: alice@wg.local / bob@wg.local / clara@wg.local / dave@wg.local");
}

main()
    .catch((e) => {
        console.error("Seed failed:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
