export type ApiWorkNode = {
  id: string;
  canvasId: string;
  title: string;
  context: string;
  x: number;
  y: number;
  activeRunId?: string | null;
};

export type ApiWorkEdge = {
  id: string;
  canvasId: string;

  sourceNodeId: string;
  targetNodeId: string;

  sourceHandle?: string | null;
  targetHandle?: string | null;

  instructionId?: string | null;
  prompt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkGraphResponse = {
  nodes: ApiWorkNode[];
  edges: ApiWorkEdge[];
};
