import type { Node } from "reactflow";
import type { CaseNodeData } from "@/types/flow/node";

type Point = { x: number; y: number };

// Keep freshly created nodes readable by nudging them away from occupied areas
// instead of stacking multiple cards in the same position.
export function resolveNonOverlappingPosition(
  base: Point,
  nodes: Array<Node<CaseNodeData>>,
): Point {
  const width = 220;
  const height = 140;
  const padding = 40;
  const step = 60;
  const maxRings = 6;

  const isFree = (x: number, y: number) =>
    nodes.every(
      (node) =>
        Math.abs(node.position.x - x) > width + padding ||
        Math.abs(node.position.y - y) > height + padding,
    );

  if (isFree(base.x, base.y)) return base;

  for (let ring = 1; ring <= maxRings; ring += 1) {
    for (let dx = -ring; dx <= ring; dx += 1) {
      for (let dy = -ring; dy <= ring; dy += 1) {
        if (Math.abs(dx) !== ring && Math.abs(dy) !== ring) continue;
        const x = base.x + dx * step;
        const y = base.y + dy * step;
        if (isFree(x, y)) return { x, y };
      }
    }
  }

  return base;
}
