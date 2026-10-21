import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CloseIcon } from "./icons";

export type ToastKind = "success" | "error" | "info";

interface ToastOptions {
  kind?: ToastKind;
  /** Inline action, e.g. Retry for a failed request. */
  action?: { label: string; onClick: () => void };
}

interface ToastItem extends ToastOptions {
  id: number;
  text: string;
}

type Notify = (text: string, options?: ToastOptions) => void;

const SUCCESS_MS = 3500;
const ERROR_MS = 8000;

// Outside a provider (isolated component tests) notifications are dropped rather than crashing.
const ToastContext = createContext<Notify>(() => undefined);

export const useToast = () => useContext(ToastContext);

function ToastView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const { id, text, kind = "info", action } = toast;

  useEffect(() => {
    // A toast carrying an action stays long enough to be used.
    const timer = setTimeout(() => onDismiss(id), kind === "error" || action ? ERROR_MS : SUCCESS_MS);
    return () => clearTimeout(timer);
  }, [id, kind, action, onDismiss]);

  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-line bg-raised px-3 py-2.5 text-sm shadow-lg animate-message-in"
    >
      <span className={`flex-1 ${kind === "error" ? "text-red-600 dark:text-red-400" : ""}`}>{text}</span>
      {action && (
        <button
          type="button"
          onClick={() => {
            onDismiss(id);
            action.onClick();
          }}
          className="shrink-0 font-medium text-accent hover:underline"
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        title="Dismiss"
        className="shrink-0 text-faint hover:text-ink"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const notify = useCallback<Notify>((text, options = {}) => {
    const id = nextId.current++;
    // Keep the stack short; the newest message matters most.
    setToasts((t) => [...t.slice(-2), { id, text, ...options }]);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
