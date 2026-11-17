import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = (props: ToasterProps) => (
  <Sonner
    theme="light"
    toastOptions={{
      unstyled: true,
      classNames: {
        toast: "stub-toast",
        icon: "hidden",
        content: "stub-toast-msg",
        actionButton: "stub-toast-tear",
      },
    }}
    {...props}
  />
)

export { Toaster }
