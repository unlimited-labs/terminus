import { defineConfig } from "react-doctor/api"

export default defineConfig({
  blocking: "warning",
  // Socket.dev wysyła listę zależności na zewnątrz; kod ma nie wychodzić z maszyny.
  supplyChain: { enabled: false },
  ignore: {
    files: ["src/components/ui/**", "src/routeTree.gen.ts", ".output/**"],
    // Granice importów pilnuje oxlint z overrides, których react-doctor nie czyta.
    rules: [
      "eslint/no-restricted-imports",
      // TanStack Form obsługuje wysłanie w JS; preventDefault jest tu zamierzone.
      "react-doctor/no-prevent-default",
    ],
  },
})
