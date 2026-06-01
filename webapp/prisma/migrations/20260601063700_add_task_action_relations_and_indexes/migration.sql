-- CreateIndex
CREATE INDEX IF NOT EXISTS "Check_householdId_roomId_idx" ON "Check"("householdId", "roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_householdId_roomId_idx" ON "Deal"("householdId", "roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Deal_householdId_createdAt_idx" ON "Deal"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FeedEvent_householdId_createdAt_idx" ON "FeedEvent"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScanAnswer_scanSessionId_idx" ON "ScanAnswer"("scanSessionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScanSession_householdId_roomId_idx" ON "ScanSession"("householdId", "roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ScanSession_householdId_createdAt_idx" ON "ScanSession"("householdId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Task_householdId_roomId_idx" ON "Task"("householdId", "roomId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAction_householdId_taskId_idx" ON "TaskAction"("householdId", "taskId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAction_householdId_action_createdAt_idx" ON "TaskAction"("householdId", "action", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TaskAction_householdId_createdAt_idx" ON "TaskAction"("householdId", "createdAt");

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAction" ADD CONSTRAINT "TaskAction_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
