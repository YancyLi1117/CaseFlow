"use client";

import React from "react";
import { ToggleButton, ToggleButtonGroup } from "@mui/material";

export type AppMode = "WORK" | "LIB";

export function ModeTabs(props: { mode: AppMode; onChange: (m: AppMode) => void }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={props.mode}
      onChange={(_, v: AppMode | null) => {
        if (!v) return;
        props.onChange(v);
      }}
    >
      <ToggleButton value="WORK">Work</ToggleButton>
      <ToggleButton value="LIB">Library</ToggleButton>
    </ToggleButtonGroup>
  );
}