export function openEventSocket(
  token: string,
  onEvent: (data: unknown) => void,
  onDown: () => void,
  onUp?: () => void,
): () => void {
  let closed = false;
  let socket: WebSocket | null = null;
  let retry = 800;
  let timer: number | undefined;

  const connect = () => {
    if (closed) return;
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${proto}//${window.location.host}/ws/events?token=${encodeURIComponent(token)}`;
    socket = new WebSocket(url);
    socket.onopen = () => {
      retry = 800;
      onUp?.();
    };
    socket.onmessage = (ev) => {
      try {
        onEvent(JSON.parse(ev.data));
      } catch {
        /* ignore malformed */
      }
    };
    socket.onclose = () => {
      onDown();
      if (closed) return;
      timer = window.setTimeout(connect, retry);
      retry = Math.min(retry * 1.6, 8000);
    };
    socket.onerror = () => {
      socket?.close();
    };
  };

  connect();
  return () => {
    closed = true;
    if (timer) window.clearTimeout(timer);
    socket?.close();
  };
}
