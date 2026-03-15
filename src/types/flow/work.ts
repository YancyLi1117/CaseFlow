import type { Node, Edge } from "reactflow";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";

export type WorkNode = Node<CaseNodeData, "caseNode">;
export type WorkEdge = Edge<EdgeData>;