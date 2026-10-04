import "server-only";

/** Turn an async generator of JSON-serializable events into an NDJSON streaming response. */
export function ndjsonResponse<T>(events: AsyncGenerator<T>, headers: Record<string, string> = {}): Response {
  const encoder = new TextEncoder();
  // Set when the client disconnects; a pull already in flight must not enqueue afterwards.
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await events.next();
        if (closed) return;
        if (done) {
          closed = true;
          controller.close();
        } else {
          controller.enqueue(encoder.encode(JSON.stringify(value) + "\n"));
        }
      } catch (err) {
        if (closed) return;
        console.error("[stream] error", err);
        closed = true;
        controller.enqueue(encoder.encode(JSON.stringify({ type: "error", message: "Stream failed" }) + "\n"));
        controller.close();
      }
    },
    async cancel() {
      closed = true;
      await events.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store, no-transform",
      "x-accel-buffering": "no",
      ...headers,
    },
  });
}
