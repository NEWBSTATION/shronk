/**
 * Topological sort for features based on their dependency chain.
 *
 * Returns features ordered so that predecessors always come before successors.
 * For features with no dependency relationship between them (multiple roots,
 * parallel branches), sorts by startDate as a tiebreaker.
 *
 * Uses a modified Kahn's algorithm with a sorted queue to ensure stable ordering.
 */
export function topoSortFeatures<
  T extends { id: string; startDate: Date | string; sortOrder?: number }
>(
  features: T[],
  dependencies: Array<{ predecessorId: string; successorId: string }>
): T[] {
  if (features.length <= 1) return features;

  const featureIds = new Set(features.map((f) => f.id));
  const featureMap = new Map(features.map((f) => [f.id, f]));

  // Build intra-set adjacency (only deps where both sides are in our feature set)
  const inDegree = new Map<string, number>();
  const successorMap = new Map<string, string[]>();

  for (const id of featureIds) {
    inDegree.set(id, 0);
    successorMap.set(id, []);
  }

  for (const dep of dependencies) {
    if (!featureIds.has(dep.predecessorId) || !featureIds.has(dep.successorId))
      continue;
    inDegree.set(
      dep.successorId,
      (inDegree.get(dep.successorId) ?? 0) + 1
    );
    successorMap.get(dep.predecessorId)!.push(dep.successorId);
  }

  // Kahn's algorithm — process roots sorted by sortOrder (then startDate) for stable output
  const getSortKey = (id: string): number => {
    const f = featureMap.get(id)!;
    return f.sortOrder ?? 0;
  };
  const getStartTime = (id: string) => {
    const f = featureMap.get(id)!;
    return new Date(f.startDate).getTime();
  };
  const compare = (a: string, b: string) => {
    const orderDiff = getSortKey(a) - getSortKey(b);
    if (orderDiff !== 0) return orderDiff;
    return getStartTime(a) - getStartTime(b);
  };

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }
  queue.sort(compare);

  const result: T[] = [];

  while (queue.length > 0) {
    const id = queue.shift()!;
    result.push(featureMap.get(id)!);

    const succs = successorMap.get(id) ?? [];
    // Sort successors by startDate so siblings come out in date order
    const readySuccs: string[] = [];
    for (const succId of succs) {
      const newDeg = (inDegree.get(succId) ?? 1) - 1;
      inDegree.set(succId, newDeg);
      if (newDeg === 0) readySuccs.push(succId);
    }
    if (readySuccs.length > 0) {
      readySuccs.sort(compare);
      // Insert into queue maintaining sorted order
      for (const s of readySuccs) {
        let inserted = false;
        for (let i = 0; i < queue.length; i++) {
          if (compare(s, queue[i]) < 0) {
            queue.splice(i, 0, s);
            inserted = true;
            break;
          }
        }
        if (!inserted) queue.push(s);
      }
    }
  }

  // Safety: add any features not reached (cycle edge case)
  for (const f of features) {
    if (!result.some((r) => r.id === f.id)) {
      result.push(f);
    }
  }

  return result;
}
