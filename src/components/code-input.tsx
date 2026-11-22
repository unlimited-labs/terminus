import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"

const SLOT = "size-11 text-lg"

/** Sześć cyfr z aplikacji w polach jak PIN (3 + 3). */
export function CodeInput({
  id,
  value,
  onChange,
  onComplete,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
}) {
  return (
    <InputOTP
      id={id}
      maxLength={6}
      inputMode="numeric"
      pattern="^[0-9]*$"
      autoComplete="one-time-code"
      autoFocus
      value={value}
      onChange={onChange}
      onComplete={onComplete}
    >
      <InputOTPGroup>
        <InputOTPSlot index={0} className={SLOT} />
        <InputOTPSlot index={1} className={SLOT} />
        <InputOTPSlot index={2} className={SLOT} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} className={SLOT} />
        <InputOTPSlot index={4} className={SLOT} />
        <InputOTPSlot index={5} className={SLOT} />
      </InputOTPGroup>
    </InputOTP>
  )
}
