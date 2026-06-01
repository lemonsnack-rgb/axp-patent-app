import type * as fabric from "fabric";

type Bag = Record<string, unknown>;

export function setMeta(obj: fabric.Object, key: string, value: unknown): void {
  (obj as unknown as Bag)[key] = value;
}

export function getMeta<T = unknown>(
  obj: fabric.Object,
  key: string,
): T | undefined {
  return (obj as unknown as Bag)[key] as T | undefined;
}

export function hasMeta(obj: fabric.Object, key: string): boolean {
  return (obj as unknown as Bag)[key] === true;
}
