import { Accessibility } from "@dnd-kit/dom"
import type { DragDropProvider, DragEndEvent, DragOverEvent, DragStartEvent } from "@dnd-kit/react"
import type { ComponentProps } from "react"

type PluginsProp = NonNullable<ComponentProps<typeof DragDropProvider>["plugins"]>

const labelOf = (entity: { data?: unknown } | null | undefined) => {
  const data = entity?.data
  return typeof data === "object" && data !== null && "label" in data ? String(data.label) : ""
}

export const boardPlugins: Extract<PluginsProp, (defaults: never) => unknown> = (defaults) => [
  ...defaults.filter((plugin) => plugin !== Accessibility),
  Accessibility.configure({
    screenReaderInstructions: {
      draggable:
        "Aby podnieść, naciśnij spację lub Enter. Przesuwaj strzałkami (z Shift szybciej), " +
        "upuść spacją lub Enterem, Escape anuluje.",
    },
    announcements: {
      dragstart: ({ operation }: DragStartEvent) => `Podniesiono: ${labelOf(operation.source)}.`,
      dragover: ({ operation }: DragOverEvent) =>
        operation.target
          ? `${labelOf(operation.source)} nad: ${labelOf(operation.target)}.`
          : `${labelOf(operation.source)} poza celem.`,
      dragend: ({ operation, canceled }: DragEndEvent) =>
        canceled || !operation.target
          ? `Anulowano przenoszenie: ${labelOf(operation.source)}.`
          : `Upuszczono ${labelOf(operation.source)} na: ${labelOf(operation.target)}.`,
    },
  }),
]
