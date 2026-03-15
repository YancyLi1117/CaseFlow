/*
  Warnings:

  - You are about to drop the column `content` on the `Instruction` table. All the data in the column will be lost.
  - Added the required column `updatedAt` to the `Edge` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Instruction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "InstructionNode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructionId" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstructionNode_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "Instruction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InstructionEdge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "instructionId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InstructionEdge_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "Instruction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Edge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "sourceNodeId" TEXT NOT NULL,
    "targetNodeId" TEXT NOT NULL,
    "sourceHandle" TEXT,
    "targetHandle" TEXT,
    "instructionId" TEXT,
    "prompt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Edge_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Edge_instructionId_fkey" FOREIGN KEY ("instructionId") REFERENCES "Instruction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Edge" ("canvasId", "id", "instructionId", "prompt", "sourceHandle", "sourceNodeId", "targetHandle", "targetNodeId") SELECT "canvasId", "id", "instructionId", "prompt", "sourceHandle", "sourceNodeId", "targetHandle", "targetNodeId" FROM "Edge";
DROP TABLE "Edge";
ALTER TABLE "new_Edge" RENAME TO "Edge";
CREATE INDEX "Edge_canvasId_idx" ON "Edge"("canvasId");
CREATE INDEX "Edge_instructionId_idx" ON "Edge"("instructionId");
CREATE TABLE "new_Instruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "template" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Instruction_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Instruction" ("canvasId", "createdAt", "id", "kind", "template", "title") SELECT "canvasId", "createdAt", "id", "kind", "template", "title" FROM "Instruction";
DROP TABLE "Instruction";
ALTER TABLE "new_Instruction" RENAME TO "Instruction";
CREATE INDEX "Instruction_canvasId_idx" ON "Instruction"("canvasId");
CREATE INDEX "Instruction_kind_idx" ON "Instruction"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InstructionNode_instructionId_idx" ON "InstructionNode"("instructionId");

-- CreateIndex
CREATE INDEX "InstructionEdge_instructionId_idx" ON "InstructionEdge"("instructionId");

-- CreateIndex
CREATE INDEX "Node_canvasId_idx" ON "Node"("canvasId");

-- CreateIndex
CREATE INDEX "NodeRun_nodeId_idx" ON "NodeRun"("nodeId");
