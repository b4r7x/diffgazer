// The server-sent-events frame parser the live review e2e harness feeds its raw
// response chunks. No I/O and no network so `test:scripts` can exercise every
// branch offline.

/**
 * Incremental server-sent-events parser: feed raw chunks, get completed
 * `{ event, data }` frames. Handles frames split across chunks, several frames
 * per chunk, multi-line `data:`, CRLF, and ignores comment/`id:` lines. A
 * trailing partial frame stays buffered until its blank-line terminator.
 */
export function createSseFrameParser() {
  let buffer = "";
  let eventName = "message";
  let dataLines = [];

  const takeFrame = () => {
    if (dataLines.length === 0) {
      eventName = "message";
      return null;
    }
    const frame = { event: eventName, data: dataLines.join("\n") };
    eventName = "message";
    dataLines = [];
    return frame;
  };

  return {
    feed(chunk) {
      buffer += chunk;
      const frames = [];
      let boundary = buffer.indexOf("\n");
      while (boundary !== -1) {
        let line = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);

        if (line === "") {
          const frame = takeFrame();
          if (frame) frames.push(frame);
        } else if (line.startsWith("event:")) {
          eventName = line.slice("event:".length).replace(/^ /, "");
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice("data:".length).replace(/^ /, ""));
        }
        // Comments (`:`), `id:`, and `retry:` lines carry nothing the harness reads.
        boundary = buffer.indexOf("\n");
      }
      return frames;
    },
  };
}
