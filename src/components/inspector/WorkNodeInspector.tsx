"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Stack,
  Typography,
  TextField,
  Divider,
  List,
  ListItemButton,
  ListItemText,
  Button,
  MenuItem,
  LinearProgress,
  Alert,
} from "@mui/material";
import type { Node, Edge } from "reactflow";
import type { CaseNodeData } from "@/types/flow/node";
import type { EdgeData } from "@/types/flow/edge";
import type { ApiCanvas } from "@/types/api/canvas";
import { patchWorkNode } from "@/components/work/workActions";
import { parseNodeContext, replaceOutput, short } from "@/lib/text";

function outgoingEdgesOf(nodeId: string, edges: Array<Edge<EdgeData>>) {
  return edges.filter((e) => e.source === nodeId);
}

function incomingEdgesOf(nodeId: string, edges: Array<Edge<EdgeData>>) {
  return edges.filter((e) => e.target === nodeId);
}

type QuickExecutePayload = { instructionId: string | null; prompt: string | null };

export function WorkNodeInspector(props: {
  canvas: ApiCanvas | null;

  nodeId: string;
  nodes: Array<Node<CaseNodeData>>;
  setNodes: React.Dispatch<React.SetStateAction<Array<Node<CaseNodeData>>>>;

  edges: Array<Edge<EdgeData>>;
  onSelectEdge: (edgeId: string) => void;

  // ✅ new: quick execute by node
  onQuickExecuteNode: (nodeId: string, payload: QuickExecutePayload) => void;

  executeStream: { nodeId: string; text: string; running: boolean } | null;
  executeDone: { nodeId: string; tick: number } | null;
}) {
  const node = useMemo(() => props.nodes.find((n) => n.id === props.nodeId) ?? null, [props.nodes, props.nodeId]);
  const outgoing = useMemo(() => outgoingEdgesOf(props.nodeId, props.edges), [props.nodeId, props.edges]);
  const incoming = useMemo(() => incomingEdgesOf(props.nodeId, props.edges), [props.nodeId, props.edges]);

  const [activeEdgeId, setActiveEdgeId] = useState<string>("");

  // quick execute local state
  const [quickInstructionId, setQuickInstructionId] = useState<string>("");
  const [quickPrompt, setQuickPrompt] = useState<string>("");
  const [draftTitle, setDraftTitle] = useState<string>("");
  const [persistedTitle, setPersistedTitle] = useState<string>("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [draftOutput, setDraftOutput] = useState<string>("");
  const [savingOutput, setSavingOutput] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const isPromptMode = quickPrompt.trim().length > 0;
  const isInstructionMode = quickInstructionId.length > 0;
  const currentOutput = parseNodeContext(node?.data.context).output;
  const isOutputDirty = node ? draftOutput !== currentOutput : false;
  const trimmedTitle = draftTitle.trim() || "Node";

  useEffect(() => {
    setQuickInstructionId("");
    setQuickPrompt("");
    setActiveEdgeId("");
    setFeedback(null);
  }, [props.nodeId]);

  useEffect(() => {
    if (!node) return;
    const nextTitle = (node.data.title ?? "").trim() || "Node";
    setDraftTitle(nextTitle);
    setPersistedTitle(nextTitle);
    setDraftOutput(parseNodeContext(node.data.context).output);
  }, [node?.id]);

  useEffect(() => {
    if (props.executeDone?.nodeId === props.nodeId) {
      setQuickInstructionId("");
      setQuickPrompt("");
    }
  }, [props.executeDone, props.nodeId]);

  if (!node) {
    return (
      <Typography variant="body2" color="text.secondary">
        Node not found.
      </Typography>
    );
  }

  useEffect(() => {
    if (!node) return;
    if (trimmedTitle === persistedTitle) return;

    const prevTitle = persistedTitle;
    setSavingTitle(true);

    const timer = window.setTimeout(() => {
      patchWorkNode(node.id, { title: trimmedTitle })
        .then(() => {
          setPersistedTitle(trimmedTitle);
        })
        .catch(() => {
          setDraftTitle(prevTitle);
          props.setNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, title: prevTitle } } : n))
          );
          setFeedback({ kind: "error", message: "Title save failed. Reverted to the last saved value." });
        })
        .finally(() => {
          setSavingTitle(false);
        });
    }, 500);

    return () => {
      window.clearTimeout(timer);
      setSavingTitle(false);
    };
  }, [node?.id, persistedTitle, props.setNodes, trimmedTitle]);

  const saveOutput = async () => {
    const previousContext = node.data.context;
    const context = replaceOutput(previousContext, draftOutput);

    setSavingOutput(true);
    setFeedback(null);
    props.setNodes((prev) =>
      prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, context } } : n))
    );

    try {
      await patchWorkNode(node.id, { context });
      setFeedback({ kind: "success", message: "Output saved." });
    } catch {
      props.setNodes((prev) =>
        prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, context: previousContext } } : n))
      );
      setDraftOutput(parseNodeContext(previousContext).output);
      setFeedback({ kind: "error", message: "Output save failed. Restored the previous value." });
    } finally {
      setSavingOutput(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="caption" color="text.secondary">
        Node ID: {node.id}
      </Typography>

      {feedback ? <Alert severity={feedback.kind}>{feedback.message}</Alert> : null}

      <Typography variant="body2" color="text.secondary">
        Incoming:{" "}
        {incoming.length === 0
          ? "(none)"
          : incoming
              .map((e) => {
                if (typeof e.label === "string" && e.label.length > 0) return short(e.label, 32);
                if (e.data?.prompt) return short(`⟶ ${e.data.prompt}`, 32);
                if (e.data?.instructionTitle) return short(`⟶ ${e.data.instructionTitle}`, 32);
                return "(no label)";
              })
              .join(", ")}
      </Typography>

      <TextField
        label="Title"
        value={draftTitle}
        onChange={(e) => {
          const title = e.target.value;
          setDraftTitle(title);
          setFeedback(null);
          props.setNodes((prev) =>
            prev.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, title } } : n))
          );
        }}
        fullWidth
        helperText={savingTitle ? "Saving title..." : "Title autosaves shortly after you stop typing."}
      />

      <TextField
        label="Output"
        value={draftOutput}
        onChange={(e) => setDraftOutput(e.target.value)}
        multiline
        minRows={10}
        maxRows={10}
        fullWidth
      />

      <Stack direction="row" spacing={1}>
        <Button variant="contained" disabled={!isOutputDirty || savingOutput} onClick={() => void saveOutput()}>
          {savingOutput ? "Saving..." : "Save Output"}
        </Button>
        <Button variant="outlined" disabled={!isOutputDirty || savingOutput} onClick={() => setDraftOutput(currentOutput)}>
          Reset
        </Button>
      </Stack>

      <Divider />

      <Typography variant="subtitle2">Outgoing edges</Typography>

      {outgoing.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No outgoing edges yet. You can drag a connection from this node, or use Execute below.
        </Typography>
      ) : (
        <>
          <List dense sx={{ p: 0, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            {outgoing.map((e) => (
              <ListItemButton
                key={e.id}
                selected={activeEdgeId === e.id}
                onClick={() => {
                  setActiveEdgeId(e.id);
                  props.onSelectEdge(e.id); // 点击直接跳去编辑 edge（你也可以去掉）
                }}
              >
                <ListItemText
                  primary={typeof e.label === "string" && e.label.length > 0 ? e.label : "(no label)"}
                  secondary={`to: ${e.target}`}
                />
              </ListItemButton>
            ))}
          </List>

        </>
      )}

      <Divider />

      <Typography variant="subtitle2">Execute</Typography>

      <TextField
        select
        label="Instruction (optional)"
        value={quickInstructionId}
        onChange={(e) => {
          const val = e.target.value;
          setQuickInstructionId(val);
          if (val) setQuickPrompt("");
        }}
        fullWidth
        disabled={isPromptMode}
      >
        <MenuItem value="">(none)</MenuItem>
        {(props.canvas?.instructions ?? []).map((i) => (
          <MenuItem key={i.id} value={i.id}>
            {i.title}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        label="Prompt (optional)"
        value={quickPrompt}
        onChange={(e) => {
          const val = e.target.value;
          setQuickPrompt(val);
          if (val.trim().length > 0) setQuickInstructionId("");
        }}
        placeholder="Write a one-off prompt (if provided, it overrides instruction)."
        multiline
        minRows={3}
        fullWidth
        disabled={isInstructionMode}
      />

      <Button
        variant="contained"
        disabled={
          props.executeStream?.running === true ||
          (!quickInstructionId && quickPrompt.trim().length === 0)
        }
        onClick={() =>
          props.onQuickExecuteNode(node.id, {
            instructionId: quickInstructionId ? quickInstructionId : null,
            prompt: quickPrompt.trim().length > 0 ? quickPrompt : null,
          })
        }
      >
        {props.executeStream?.running && props.executeStream.nodeId === node.id ? "In progress..." : "Execute → next node"}
      </Button>

      {props.executeStream && props.executeStream.nodeId === node.id ? (
        <>
          {props.executeStream.running ? <LinearProgress /> : null}
          <TextField
            label="Live Output"
            value={props.executeStream.text}
            multiline
            minRows={6}
            maxRows={6}
            fullWidth
            InputProps={{ readOnly: true }}
          />
        </>
      ) : null}
    </Stack>
  );
}
