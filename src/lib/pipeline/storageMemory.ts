import { CatalogedMessage, StorageSink } from "./types";

type Indexes = {
  byCollection: Map<string, number>;
};

const globalStore = globalThis as unknown as {
  __ingestMem?: { data: CatalogedMessage[]; indexes: Indexes };
};

if (!globalStore.__ingestMem) {
  globalStore.__ingestMem = { data: [], indexes: { byCollection: new Map() } };
}

const mem = globalStore.__ingestMem;

export const memorySink: StorageSink = {
  async write(batch) {
    for (const m of batch) {
      mem.data.push(m);
      const k = m.collection;
      mem.indexes.byCollection.set(k, (mem.indexes.byCollection.get(k) ?? 0) + 1);
    }
    // cap memory to last 50k
    if (mem.data.length > 50_000) mem.data.splice(0, mem.data.length - 50_000);
    return { written: batch.length };
  },
  stats() {
    const byCollection: Record<string, number> = {};
    for (const [k, v] of mem.indexes.byCollection.entries()) byCollection[k] = v;
    return { total: mem.data.length, byCollection };
  },
  sample(limit = 50) {
    return mem.data.slice(-limit);
  },
};
