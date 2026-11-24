// pnpm release: check + e2e, potem obraz linux/amd64 z tagiem = wersja z gita, wysłany do rejestru.
import { execSync } from "node:child_process"

const run = (command: string) => execSync(command, { stdio: "inherit" })
const read = (command: string) => execSync(command, { encoding: "utf8" }).trim()

const image = process.env.IMAGE
if (!image) {
  console.error("Ustaw IMAGE, np. IMAGE=registry.wimiip.eu/terminus pnpm release")
  process.exit(1)
}
if (read("git status --porcelain")) {
  console.error("Najpierw zacommituj zmiany — tag obrazu to wersja z gita.")
  process.exit(1)
}

const tag = read("git describe --tags --always")
run("pnpm check")
run("pnpm e2e")
run(`docker buildx build --platform linux/amd64 -t ${image}:${tag} -t ${image}:latest --push .`)
const site = "https://terminus.wimiip.eu"
console.log(`Wysłano ${image}:${tag} (i :latest). Na VPS: IMAGE_TAG=${tag} w .env, potem docker compose up -d.
Po nginx -s reload sprawdź serwer MCP:
  curl -s -o /dev/null -w "%{http_code}\\n" ${site}/.well-known/oauth-protected-resource/mcp   # 200
  curl -s -o /dev/null -w "%{http_code}\\n" ${site}/.well-known/oauth-authorization-server    # 200
  curl -si -X POST ${site}/mcp | grep -i "^HTTP\\|www-authenticate"                            # 401 + WWW-Authenticate`)
