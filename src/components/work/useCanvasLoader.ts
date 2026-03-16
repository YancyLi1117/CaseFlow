"use client";

import { useEffect } from "react";

import { apiGet } from "@/lib/apiClient";
import type { ApiCanvas } from "@/types/api/canvas";

export function useCanvasLoader(
  setCanvas: React.Dispatch<React.SetStateAction<ApiCanvas | null>>,
) {
  useEffect(() => {
    // The app currently works against a single active canvas returned by the
    // backend. Loading it once here gives the rest of the page a stable root.
    (async () => {
      const canvas = await apiGet<ApiCanvas>("/api/canvas");
      setCanvas(canvas);
    })().catch(console.error);
  }, [setCanvas]);
}
