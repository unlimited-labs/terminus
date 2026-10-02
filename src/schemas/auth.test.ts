import { expect, test } from "vitest"

import { loginSearchSchema } from "./auth"

const target = (redirect: string) => loginSearchSchema.parse({ redirect }).redirect

test("redirect po logowaniu przyjmuje tylko ścieżki wewnętrzne", () => {
  expect(target("/zaliczenia/1?x=//a")).toBe("/zaliczenia/1?x=//a")
  expect(target("//evil.com")).toBeUndefined()
  expect(target("/\\evil.com")).toBeUndefined()
  expect(target("https://evil.com")).toBeUndefined()
  expect(loginSearchSchema.parse({}).redirect).toBeUndefined()
})
