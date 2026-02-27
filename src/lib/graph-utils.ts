/**
 * BFS helper to find all transitive successors of a node in a dependency graph.
 * Reused by both server (delta-shift PATCH) and client (drag preview).
 */
export function getTransitiveSuccessors(
  startId: string,
  successorMap: Map<string, string[]>
): Set<string> {
  const visited = new Set<string>();
  const queue = successorMap.get(startId) ?? [];
  for (const id of queue) visited.add(id);

  let i = 0;
  while (i < queue.length) {
    const current = queue[i++];
    for (const next of successorMap.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }

  return visited;
}
