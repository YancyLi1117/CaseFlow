export type WorkSelection =
  | { kind: "NONE" }
  | { kind: "NODE"; nodeId: string }
  | { kind: "EDGE"; edgeId: string };

export type LibSelection =
  | { kind: "NONE" }
  | { kind: "INSTRUCTION"; instructionId: string }
  | { kind: "LIB_NODE"; nodeId: string }
  | { kind: "LIB_EDGE"; edgeId: string };

export type Selection = { mode: "WORK"; sel: WorkSelection } | { mode: "LIB"; sel: LibSelection };