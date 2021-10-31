import { useEffect, useRef } from "react";

export function useWindowEvent<K extends keyof WindowEventMap>(type: K, handler: (ev: WindowEventMap[K]) => void, ): void {
    useEffect(() => {
        const handler_ = handler;
        window.addEventListener(type, handler_);
        return () => window.removeEventListener(type, handler_);
    });
}

type KeyHandler = (e: KeyboardEvent) => void;
type AddKeyHandler = (key: string, handler: KeyHandler) => void;

export function useKeyEvent(): AddKeyHandler {
    const handlers = useRef<Record<string, KeyHandler>>({});
    useWindowEvent('keypress', e => handlers.current[e.key] && handlers.current[e.key](e));
    return (key, handler) => { handlers.current[key] = handler; };
}
