const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const household = await prisma.household.create({
        data: {
            name: "WG Sonnenallee",
            address: "Sonnenallee 123, Berlin",
            notes: {
                create: [
                    { title: "Wi-Fi Password", content: "SSID: SonnenWG_5G\nKey: fritz_box_829_sky", category: "Access" },
                    { title: "Heating Quirks", content: "Radius in hallway... nível 3 max.", category: "Utilities" }
                ]
            },
            tasks: {
                create: [
                    { title: "Take out Blue Bins", status: "OPEN", dueDate: new Date(Date.now() + 86400000) }
                ]
            }
        }
    });

    console.log(`Seed complete: ${household.name} (${household.id})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
