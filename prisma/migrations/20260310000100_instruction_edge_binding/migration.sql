-- AlterTable
ALTER TABLE "InstructionEdge" ADD COLUMN "edgeInstructionId" TEXT;
ALTER TABLE "InstructionEdge" ADD COLUMN "prompt" TEXT;

-- CreateIndex
CREATE INDEX "InstructionEdge_edgeInstructionId_idx" ON "InstructionEdge"("edgeInstructionId");
