import { useRef, useState, type ComponentProps, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ButtonProps = ComponentProps<typeof Button>

/**
 * Przycisk akcji nieodwracalnej: pyta w dialogu, w trakcie blokuje potwierdzenie.
 * Porażka `onConfirm` (wyjątek albo `{ ok: false }`) zostawia dialog otwarty — komunikat jest już w toaście.
 */
export function ConfirmButton({
  children,
  title,
  description,
  confirmLabel,
  onConfirm,
  disabled,
  body,
  confirmDisabled,
  triggerVariant = "ghost",
  triggerSize = "xs",
}: {
  children: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  onConfirm: () => unknown
  disabled?: boolean
  body?: ReactNode
  confirmDisabled?: boolean
  triggerVariant?: ButtonProps["variant"]
  triggerSize?: ButtonProps["size"]
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  // `busy` dociera do przycisku asynchronicznie — podwójne kliknięcie blokuje dopiero ref.
  const inFlight = useRef(false)
  const confirm = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      if (!isFailure(await onConfirm())) setOpen(false)
    } catch {
      // błąd pokazuje już mutacja (toast)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Anuluj
          </Button>
          <Button variant="destructive" disabled={busy || confirmDisabled} onClick={confirm}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const isFailure = (result: unknown) =>
  typeof result === "object" && result !== null && "ok" in result && result.ok === false
