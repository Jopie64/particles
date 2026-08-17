import { useEffect, useRef } from "react";

export function useWindowEvent<K extends keyof WindowEventMap>(type: K, handler: (ev: WindowEventMap[K]) => void): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (ev: WindowEventMap[K]) => handlerRef.current(ev);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
  }, [type]);
}

type KeyHandler = (e: KeyboardEvent) => void;
type AddKeyHandler = (key: string, handler: KeyHandler) => void;

export function useKeyEvent(): AddKeyHandler {
  const handlers = useRef<Record<string, KeyHandler>>({});

  useWindowEvent('keydown', (e) => {
    const key = e.key;
    const lowerKey = key.toLowerCase();
    const handler = handlers.current[key] || handlers.current[lowerKey];
    if (handler) {
      if (key === ' ') {
        e.preventDefault();
      }
      handler(e);
    }
  });

  return (key, handler) => {
    handlers.current[key] = handler;
  };
}
