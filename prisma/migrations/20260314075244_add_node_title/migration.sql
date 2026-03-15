-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Node" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "canvasId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Node',
    "context" TEXT NOT NULL,
    "x" REAL NOT NULL,
    "y" REAL NOT NULL,
    "activeRunId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Node_canvasId_fkey" FOREIGN KEY ("canvasId") REFERENCES "Canvas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Node" ("activeRunId", "canvasId", "context", "createdAt", "id", "updatedAt", "x", "y") SELECT "activeRunId", "canvasId", "context", "createdAt", "id", "updatedAt", "x", "y" FROM "Node";
DROP TABLE "Node";
ALTER TABLE "new_Node" RENAME TO "Node";
CREATE INDEX "Node_canvasId_idx" ON "Node"("canvasId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
