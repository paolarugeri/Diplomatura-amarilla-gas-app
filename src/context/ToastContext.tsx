import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'

type Kind = 'success' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  text: string
}

const ToastContext = createContext<(kind: Kind, text: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, text }].slice(-2))
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const styles: Record<Kind, string> = {
    success: 'bg-ink text-white',
    error: 'bg-bad text-white',
    info: 'bg-white text-ink border border-line',
  }
  const Icon = { success: CheckCircle2, error: AlertTriangle, info: Info }

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 top-3 z-[2000] flex flex-col items-center gap-2 px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map((t) => {
          const I = Icon[t.kind]
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-lg ${styles[t.kind]}`}
            >
              <I className={`mt-0.5 size-5 shrink-0 ${t.kind === 'success' ? 'text-brand' : ''}`} />
              <span className="flex-1">{t.text}</span>
              <button
                aria-label="Cerrar aviso"
                onClick={() => setToasts((all) => all.filter((x) => x.id !== t.id))}
                className="opacity-70 hover:opacity-100"
              >
                <X className="size-4" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext)
