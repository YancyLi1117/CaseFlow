// Work mode only exposes graph objects that exist on the main canvas.
export type WorkSelection =
  | { kind: "NONE" }
  | { kind: "NODE"; nodeId: string }
  | { kind: "EDGE"; edgeId: string };

// Lib mode can focus either on the instruction itself or on items inside a
// CUSTOM instruction's mini-canvas.
export type LibSelection =
  | { kind: "NONE" }
  | { kind: "INSTRUCTION"; instructionId: string }
  | { kind: "LIB_NODE"; nodeId: string }
  | { kind: "LIB_EDGE"; edgeId: string };

export type Selection = { mode: "WORK"; sel: WorkSelection } | { mode: "LIB"; sel: LibSelection };
