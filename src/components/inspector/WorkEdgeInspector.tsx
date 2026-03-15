"use client";

import React, { useMemo, useState } from "react";
import { Stack, Typography, TextField, MenuItem, Button, ToggleButtonGroup, ToggleButton } from "@mui/material";
import type { Edge } from "reactflow";
import type { EdgeData } from "@/types/flow/edge";
import type { ApiCanvas } from "@/types/api/canvas";
import { short } from "@/lib/text";
import { patchWorkEdge } from "@/components/work/workActions";

type Mode = "INSTRUCTION" | "PROMPT";

function inferMode(edge: Edge<EdgeData>): Mode {
  const p = edge.data?.prompt ?? "";
  return p.trim().length > 0 ? "PROMPT" : "INSTRUCTION";
}

function buildLabel(canvas: ApiCanvas | null, m: Mode, instructionId: string | null, prompt: string | null) {
  if (m === "PROMPT") return prompt ? `⟶ ${short(prompt)}` : "";
  if (instructionId) {
    const title = canvas?.instructions.find((i) => i.id === instructionId)?.title ?? "Instruction";
    return `⟶ ${title}`;
  }
  return "";
}

export function WorkEdgeInspector(props: {
  edgeId: string;
  canvas: ApiCanvas | null;
  edges: Array<Edge<EdgeData>>;
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
}) {
  const edge = useMemo(() => props.edges.find((e) => e.id === props.edgeId) ?? null, [props.edges, props.edgeId]);
  if (!edge) {
    return (
      <Typography variant="body2" color="text.secondary">
        Edge not found in client state.
      </Typography>
    );
  }

  // key trick: when edgeId changes, component remount -> drafts reset; no effect needed
  return <Inner key={edge.id} edge={edge} canvas={props.canvas} setEdges={props.setEdges} />;
}

function Inner(props: {
  edge: Edge<EdgeData>;
  canvas: ApiCanvas | null;
  setEdges: React.Dispatch<React.SetStateAction<Array<Edge<EdgeData>>>>;
}) {
  const initialMode = inferMode(props.edge);
  const [mode, setMode] = useState<Mode>(initialMode);

  const [draftInstructionId, setDraftInstructionId] = useState<string>(props.edge.data?.instructionId ?? "");
  const [draftPrompt, setDraftPrompt] = useState<string>(props.edge.data?.prompt ?? "");

  const instructionOptions = props.canvas?.instructions ?? [];

  const save = async () => {
    const instructionId = mode === "INSTRUCTION" ? (draftInstructionId || null) : null;
    const prompt = mode === "PROMPT" ? (draftPrompt.trim() || null) : null;

    // optimistic UI update
    props.setEdges((prev) =>
      prev.map((e) => {
        if (e.id !== props.edge.id) return e;

        const instrTitle =
          instructionId
            ? props.canvas?.instructions.find((i) => i.id === instructionId)?.title
            : undefined;

        return {
          ...e,
          label: buildLabel(props.canvas, mode, instructionId, prompt),
          data: {
            instructionId,
            prompt: prompt ?? undefined,
            instructionTitle: instrTitle,
          },
        };
      })
    );

    await patchWorkEdge(props.edge.id, { instructionId, prompt });
  };

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        Edge ID: {props.edge.id}
      </Typography>

      <ToggleButtonGroup
        exclusive
        value={mode}
        onChange={(_, v: Mode | null) => {
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

      <Typography variant="body2" color="text.secondary">
        Label preview:{" "}
        {buildLabel(
          props.canvas,
          mode,
          mode === "INSTRUCTION" ? (draftInstructionId || null) : null,
          mode === "PROMPT" ? (draftPrompt.trim() || null) : null
        )}
      </Typography>
    </Stack>
  );
}