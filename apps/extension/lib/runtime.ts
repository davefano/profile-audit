// Generic typed messaging between extension contexts (panel, background,
// content script). Each feature defines its own message map on top of this.

export type ErrorResponse = { error: string; message?: string; tabUrl?: string | null };

export const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** An Error carrying an ErrorResponse code across async boundaries. */
export class CodedError extends Error {
  constructor(
    readonly code: string,
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function isError(r: unknown): r is ErrorResponse {
  return !!r && typeof r === 'object' && 'error' in r && typeof (r as ErrorResponse).error === 'string';
}

/** A map of message type → { req, res }. */
export type MessageMap<M> = { [K in keyof M]: { req: { type: K }; res: unknown } };

export function send<M extends MessageMap<M>, K extends keyof M>(msg: M[K]['req']): Promise<M[K]['res']> {
  return browser.runtime.sendMessage(msg);
}

export function sendToTab<M extends MessageMap<M>, K extends keyof M>(tabId: number, msg: M[K]['req']): Promise<M[K]['res']> {
  return browser.tabs.sendMessage(tabId, msg);
}

/** One handler per message: adding a message without handling it is a type error. */
export type Handlers<M extends MessageMap<M>> = { [K in keyof M]: (msg: M[K]['req']) => Promise<M[K]['res']> };

/**
 * Register handlers for a message map, each checked against its response
 * type. Messages without a handler are left for other listeners, so several
 * features can share one context. Uses sendResponse + `return true`, the form
 * every browser supports.
 */
export function serve<M extends MessageMap<M>>(handlers: Handlers<M>) {
  browser.runtime.onMessage.addListener((msg: { type?: string }, _sender, sendResponse) => {
    const handle = typeof msg?.type === 'string' ? (handlers as Record<string, ((m: unknown) => Promise<unknown>) | undefined>)[msg.type] : undefined;
    if (!handle) return false;
    handle(msg).then(sendResponse, (e) => sendResponse({ error: 'handler_failed', message: errorText(e) }));
    return true;
  });
}
