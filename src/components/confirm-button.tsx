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
import { resultOk } from "@/messages.pl"

type ButtonProps = ComponentProps<typeof Button>

/** Przycisk akcji nieodwracalnej: pyta w dialogu (`ConfirmDialog`). */
export function ConfirmButton({
  children,
  disabled,
  triggerVariant = "ghost",
  triggerSize = "xs",
  ...dialog
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
  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog open={open} onOpenChange={setOpen} {...dialog} />
    </>
  )
}

/**
 * Dialog potwierdzenia akcji nieodwracalnej; w trakcie blokuje potwierdzenie.
 * Porażka `onConfirm` (wyjątek albo `{ ok: false }`) zostawia dialog otwarty — komunikat jest już w toaście.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  body,
  confirmLabel,
  confirmDisabled,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: ReactNode
  body?: ReactNode
  confirmLabel: string
  confirmDisabled?: boolean
  onConfirm: () => unknown
}) {
  const [busy, setBusy] = useState(false)
  // `busy` dociera do przycisku asynchronicznie — podwójne kliknięcie blokuje dopiero ref.
  const inFlight = useRef(false)
  const confirm = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    try {
      if (resultOk(await onConfirm()) !== false) onOpenChange(false)
    } catch {
      // błąd pokazuje już mutacja (toast)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
