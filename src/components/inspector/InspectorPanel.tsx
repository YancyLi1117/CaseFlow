"use client";

import React from "react";
import { Paper, Typography, Divider, Stack, Button } from "@mui/material";
import type { Node, Edge } from "reactflow";

import type { ApiCanvas } from "@/types/api/canvas";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";

import { WorkNodeInspector } from "@/components/inspector/WorkNodeInspector";
import { WorkEdgeInspector } from "@/components/inspector/WorkEdgeInspector";

export type WorkSelection =
  | { kind: "NONE" }
  | { kind: "NODE"; nodeId: string }
  | { kind: "EDGE"; edgeId: string };

export function InspectorPanel(props: {
  canvas: ApiCanvas | null;

  selection: WorkSelection;

  workNodes: Array<Node<CaseNodeData>>;
  setWorkNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData>>>>;

  workEdges: Array<Edge<EdgeData>>;
  setWorkEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;

  // allow node inspector to jump to edge inspector
  onSelectWorkEdge: (edgeId: string) => void;

  onQuickExecuteNode: (nodeId: string, payload: { instructionId: string | null; prompt: string | null }) => void;

  onCollapse: () => void;

  executeStream: { nodeId: string; text: string; running: boolean } | null;
  executeDone: { nodeId: string; tick: number } | null;
}) {
  return (
    <Paper
      elevation={0}
      sx={{
        borderLeft: { xs: "none", md: "1px solid" },
        borderTop: { xs: "1px solid", md: "none" },
        borderColor: "divider",
        p: 2,
        height: "100%",
        overflow: "auto",
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="h6">Inspector</Typography>
        <Button size="small" variant="outlined" onClick={props.onCollapse}>
          Collapse
        </Button>
      </Stack>
      <Divider sx={{ mb: 2 }} />

      {props.selection.kind === "NONE" ? (
        <Typography variant="body2" color="text.secondary">
          Select a node or edge.
        </Typography>
      ) : null}

      {props.selection.kind === "NODE" ? (
        <WorkNodeInspector
        canvas={props.canvas}
        nodeId={props.selection.nodeId}
        nodes={props.workNodes}
        setNodes={props.setWorkNodes}
        edges={props.workEdges}
        onSelectEdge={props.onSelectWorkEdge}
        onQuickExecuteNode={props.onQuickExecuteNode}
        executeStream={props.executeStream}
        executeDone={props.executeDone}
      />
      ) : null}

      {props.selection.kind === "EDGE" ? (
        <WorkEdgeInspector
          edgeId={props.selection.edgeId}
          canvas={props.canvas}
          edges={props.workEdges}
          setEdges={props.setWorkEdges}
        />
      ) : null}
    </Paper>
  );
}
