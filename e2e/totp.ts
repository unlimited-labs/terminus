import { base32 } from "@better-auth/utils/base32"
import { createOTP } from "@better-auth/utils/otp"

/** Bieżący kod z adresu `otpauth://` (sekret w Base32, jak w kodzie QR). */
export function totpCode(totpURI: string) {
  const secret = new URL(totpURI).searchParams.get("secret")
  if (!secret) throw new Error("Adres otpauth bez sekretu.")
  return createOTP(base32.decode(secret)).totp()
}
