export type ApiInstruction = {
    id: string;
    canvasId: string;
    kind: "QUICK" | "CUSTOM";
    title: string;
    description: string | null;
    template: string | null;
    createdAt: string;
    updatedAt: string;
  };
  
  export type InstructionListResponse = {
    instructions: {
      id: string;
      kind: "QUICK" | "CUSTOM";
      title: string;
      description: string | null;
    }[];
  };
  
  export type ApiLibNode = {
    id: string;
    instructionId: string;
    context: string;
    x: number;
    y: number;
  };
  
  export type ApiLibEdge = {
    id: string;
    instructionId: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string | null;
    targetHandle: string | null;
    edgeInstructionId?: string | null;
    prompt?: string | null;
  };
  
  export type LibGraphResponse = {
    nodes: ApiLibNode[];
    edges: ApiLibEdge[];
  };
