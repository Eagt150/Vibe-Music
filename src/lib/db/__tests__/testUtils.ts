import { IDBFactory } from "fake-indexeddb";
import { Blob as NodeBlob } from "node:buffer";
import { resetDBForTests } from "../index";

/** Gives each test a completely empty IndexedDB universe. */
export function resetFakeIndexedDB(): void {
  globalThis.indexedDB = new IDBFactory();
  resetDBForTests();
}

/** fake-indexeddb's structured-clone step round-trips Blobs through Node's
 * Blob implementation, not jsdom's patched global — using jsdom's `Blob`
 * here produces objects that lose their .text()/.arrayBuffer() methods after
 * a round trip in this test environment. Real browsers don't have this split
 * (there's only one Blob), so this is a test-environment-only workaround. */
export function makeBlob(content: string, type = "audio/mpeg"): Blob {
  return new NodeBlob([content], { type }) as unknown as Blob;
}
