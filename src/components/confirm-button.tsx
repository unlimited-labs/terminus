import { useState, type ComponentProps, type ReactNode } from "react"

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

/** Przycisk akcji nieodwracalnej: pyta w dialogu, w trakcie blokuje potwierdzenie. */
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
  onConfirm: () => Promise<unknown>
  disabled?: boolean
  body?: ReactNode
  confirmDisabled?: boolean
  triggerVariant?: ButtonProps["variant"]
  triggerSize?: ButtonProps["size"]
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const confirm = async () => {
    setBusy(true)
    try {
      await onConfirm()
      setOpen(false)
    } catch {
      // błąd pokazuje już mutacja (toast)
    } finally {
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
