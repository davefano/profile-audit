// Internal: one way to turn a thrown value into error text. Not exported from the layer.

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));
