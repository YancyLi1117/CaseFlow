"use client";

import React from "react";
import { Box, List, ListItemButton, ListItemText, Typography } from "@mui/material";
import type { InstructionListResponse } from "@/types/api/lib";

export function InstructionList(props: {
  data: InstructionListResponse | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  if (!props.data) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Loading…
        </Typography>
      </Box>
    );
  }

  return (
    <List dense sx={{ p: 0 }}>
      {props.data.instructions.map((i) => (
        <ListItemButton
          key={i.id}
          selected={props.selectedId === i.id}
          onClick={() => props.onSelect(i.id)}
        >
          <ListItemText
            primary={`${i.kind === "QUICK" ? "QUICK" : "CUSTOM"} · ${i.title}`}
            secondary={i.description ?? ""}
          />
        </ListItemButton>
      ))}
    </List>
  );
}