"use client";

import React from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { Paper, Typography } from "@mui/material";
import type { CaseNodeData } from "@/types/flow/node";
import { parseNodeContext, short } from "@/lib/text";

export default function CaseNode(props: NodeProps<CaseNodeData>) {
  const display = parseNodeContext(props.data.context ?? "").output;
  const title = (props.data.title ?? "").trim() || "Node";
  return (
    <Paper
      elevation={3}
      sx={{
        p: 1,
        width: 220,
        borderRadius: 2,
        border: "1px solid",
        borderColor: props.selected ? "primary.main" : "divider",
        borderWidth: props.selected ? 2 : 1,
        boxShadow: props.selected ? "0 0 0 2px rgba(25,118,210,0.18)" : undefined,
      }}
    >
      <Handle type="target" position={Position.Left} id="in" />
      <Typography variant="subtitle1" sx={{ mb: 0.5, fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
        {short(display, 120)}
      </Typography>
      <Handle type="source" position={Position.Right} id="out" />
    </Paper>
  );
}
