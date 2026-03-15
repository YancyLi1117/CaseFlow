-- CreateIndex
CREATE INDEX "Edge_sourceNodeId_idx" ON "Edge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "Edge_targetNodeId_idx" ON "Edge"("targetNodeId");

-- CreateIndex
CREATE INDEX "InstructionEdge_sourceNodeId_idx" ON "InstructionEdge"("sourceNodeId");

-- CreateIndex
CREATE INDEX "InstructionEdge_targetNodeId_idx" ON "InstructionEdge"("targetNodeId");
