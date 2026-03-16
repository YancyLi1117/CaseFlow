"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Stack, Typography, TextField, Button, Divider, MenuItem, ToggleButtonGroup, ToggleButton, Paper } from "@mui/material";
import type { Node, Edge } from "reactflow";
import type { ApiCanvas } from "@/types/api/canvas";
import type { ApiInstruction } from "@/types/api/lib";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import { apiPatch, apiDelete } from "@/lib/apiClient";
import { short } from "@/lib/text";
import { patchInstruction, deleteInstruction } from "@/components/lib/libActions";

type EdgeMode = "INSTRUCTION" | "PROMPT";

function inferEdgeMode(edge: Edge<EdgeData>): EdgeMode {
  const p = edge.data?.prompt ?? "";
  return p.trim().length > 0 ? "PROMPT" : "INSTRUCTION";
}

function buildEdgeLabel(canvas: ApiCanvas | null, mode: EdgeMode, instructionId: string | null, prompt: string | null) {
  if (mode === "PROMPT") return prompt ? `⟶ ${short(prompt)}` : "";
  if (instructionId) {
    const title = canvas?.instructions.find((i) => i.id === instructionId)?.title ?? "Instruction";
    return `⟶ ${title}`;
  }
  return "";
}

export function LibInspectorPanel(props: {
  canvas: ApiCanvas | null;
  instruction: ApiInstruction | null;
  onInstructionUpdated: (inst: ApiInstruction) => void;
  onInstructionDeleted: (id: string) => void;
  nodeId: string | null;
  edgeId: string | null;
  nodes: Array<Node<CaseNodeData>>;
  setNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData>>>>;
  edges: Array<Edge<EdgeData>>;
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
  onClearSelection: () => void;
  onCollapse: () => void;
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
      {!props.instruction ? (
        <Typography variant="body2" color="text.secondary">
          Select an instruction.
        </Typography>
      ) : (
        <LibInspectorContent {...props} instruction={props.instruction} />
      )}
    </Paper>
  );
}

function LibInspectorContent(
  props: Omit<React.ComponentProps<typeof LibInspectorPanel>, "instruction"> & { instruction: ApiInstruction }
) {
  const instruction = props.instruction;

  const node = useMemo(
    () => (props.nodeId ? props.nodes.find((n) => n.id === props.nodeId) ?? null : null),
    [props.nodes, props.nodeId]
  );

  const edge = useMemo(
    () => (props.edgeId ? props.edges.find((e) => e.id === props.edgeId) ?? null : null),
    [props.edges, props.edgeId]
  );

  const [draftTitle, setDraftTitle] = useState<string>("");
  const [draftDescription, setDraftDescription] = useState<string>("");
  const [draftTemplate, setDraftTemplate] = useState<string>("");

  useEffect(() => {
    setDraftTitle(instruction.title ?? "");
    setDraftDescription(instruction.description ?? "");
    setDraftTemplate(instruction.template ?? "");
  }, [instruction.id]);

  if (node) {
    return (
      <Stack spacing={2}>
        <Typography variant="caption" color="text.secondary">
          Node ID: {node.id}
        </Typography>

        <TextField
          label="Context"
          value={node.data.context}
          onChange={(e) => {
            const context = e.target.value;
            props.setNodes((prev) =>
              prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, context } } : n))
            );
            void apiPatch(`/api/lib/nodes/${node.id}`, { context });
          }}
          multiline
          minRows={10}
          maxRows={10}
          fullWidth
        />

        <Button
          color="error"
          variant="outlined"
          onClick={() => {
            void apiDelete(`/api/lib/nodes/${node.id}`).then(() => {
              props.setNodes((prev) => prev.filter((n) => n.id !== node.id));
              props.setEdges((prev) => prev.filter((e) => e.source !== node.id && e.target !== node.id));
              props.onClearSelection();
            });
          }}
        >
          Delete Node
        </Button>
      </Stack>
    );
  }

  if (edge) {
    return (
      <LibEdgeInspector
        key={edge.id}
        edge={edge}
        canvas={props.canvas}
        setEdges={props.setEdges}
        onDelete={() => {
          void apiDelete(`/api/lib/edges/${edge.id}`).then(() => {
            props.setEdges((prev) => prev.filter((e) => e.id !== edge.id));
            props.onClearSelection();
          });
        }}
      />
    );
  }

  const saveInstruction = async () => {
    const updated = await patchInstruction(instruction.id, {
      title: draftTitle,
      description: draftDescription.trim().length > 0 ? draftDescription : null,
      template: instruction.kind === "QUICK" ? draftTemplate : undefined,
    });
    props.onInstructionUpdated(updated);
  };

  const removeInstruction = async () => {
    await deleteInstruction(instruction.id);
    props.onInstructionDeleted(instruction.id);
  };

  const canSave = instruction.kind !== "QUICK" || draftTemplate.trim().length > 0;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2">Instruction</Typography>
      <Typography variant="caption" color="text.secondary">
        {instruction.kind} · {instruction.id}
      </Typography>
      <Divider />

      <TextField label="Title" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} fullWidth />
      <TextField
        label="Description"
        value={draftDescription}
        onChange={(e) => setDraftDescription(e.target.value)}
        multiline
        minRows={3}
        fullWidth
      />

      {instruction.kind === "QUICK" ? (
        <TextField
          label="Prompt"
          value={draftTemplate}
          onChange={(e) => setDraftTemplate(e.target.value)}
          multiline
          minRows={6}
          fullWidth
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          CUSTOM instruction graph is edited in the mini canvas.
        </Typography>
      )}

      <Button variant="contained" disabled={!canSave} onClick={() => void saveInstruction()}>
        Save Instruction
      </Button>
      <Button color="error" variant="outlined" onClick={() => void removeInstruction()}>
        Delete Instruction
      </Button>
    </Stack>
  );
}

function LibEdgeInspector(props: {
  edge: Edge<EdgeData>;
  canvas: ApiCanvas | null;
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
  onDelete: () => void;
}) {
  const initialMode = inferEdgeMode(props.edge);
  const [mode, setMode] = useState<EdgeMode>(initialMode);
  const [draftInstructionId, setDraftInstructionId] = useState<string>(props.edge.data?.instructionId ?? "");
  const [draftPrompt, setDraftPrompt] = useState<string>(props.edge.data?.prompt ?? "");

  const instructionOptions = props.canvas?.instructions ?? [];

  const save = async () => {
    const instructionId = mode === "INSTRUCTION" ? (draftInstructionId || null) : null;
    const prompt = mode === "PROMPT" ? (draftPrompt.trim() || null) : null;

    props.setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== props.edge.id) return e;

        const instrTitle =
          instructionId ? props.canvas?.instructions.find((i) => i.id === instructionId)?.title : undefined;

        return {
          ...e,
          label: buildEdgeLabel(props.canvas, mode, instructionId, prompt),
          data: {
            instructionId,
            prompt: prompt ?? undefined,
            instructionTitle: instrTitle,
          },
        };
      })
    );

    await apiPatch(`/api/lib/edges/${props.edge.id}`, { edgeInstructionId: instructionId, prompt });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        Edge ID: {props.edge.id}
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(_, v: EdgeMode | null) => {
          if (!v) return;
          setMode(v);
        }}
        size="small"
      >
        <ToggleButton value="INSTRUCTION">Use Instruction</ToggleButton>
        <ToggleButton value="PROMPT">Write Prompt</ToggleButton>
      </ToggleButtonGroup>

      {mode === "INSTRUCTION" ? (
        <TextField
          select
          label="Instruction"
          value={draftInstructionId}
          onChange={(e) => setDraftInstructionId(e.target.value)}
          fullWidth
        >
          <MenuItem value="">(none)</MenuItem>
          {instructionOptions.map((i) => (
            <MenuItem key={i.id} value={i.id}>
              {i.kind}: {i.title}
            </MenuItem>
          ))}
        </TextField>
      ) : (
        <TextField
          label="Prompt"
          value={draftPrompt}
          onChange={(e) => setDraftPrompt(e.target.value)}
          multiline
          minRows={6}
          fullWidth
        />
      )}

      <Button variant="contained" onClick={() => void save()}>
        Save Edge
      </Button>
      <Button color="error" variant="outlined" onClick={props.onDelete}>
        Delete Edge
      </Button>

      <Typography variant="body2" color="text.secondary">
        Label preview:{" "}
        {buildEdgeLabel(
          props.canvas,
          mode,
          mode === "INSTRUCTION" ? (draftInstructionId || null) : null,
          mode === "PROMPT" ? (draftPrompt.trim() || null) : null
        )}
      </Typography>
    </Stack>
  );
}
