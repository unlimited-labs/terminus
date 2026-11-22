import { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot } from "@/components/ui/input-otp"

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
      {[
        [0, 1, 2],
        [3, 4, 5],
      ].map((group, i) => (
        <span key={group[0]} className="contents">
          {i > 0 && <InputOTPSeparator />}
          <InputOTPGroup>
            {group.map((index) => (
              <InputOTPSlot key={index} index={index} className="size-11 text-lg" />
            ))}
          </InputOTPGroup>
        </span>
      ))}
    </InputOTP>
  )
}
