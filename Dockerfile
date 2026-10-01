# Obraz budowany w kontenerze Linuksa (moduły natywne muszą pasować do platformy docelowej).
FROM node:24-slim AS build
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:24-slim
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV COREPACK_HOME=/opt/corepack
RUN mkdir -p /opt/corepack && corepack enable && corepack prepare pnpm@12.8.1 --activate && pnpm --version && chmod -R a+rX /opt/corepack
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 TZ=Europe/Warsaw
# `pnpm reset-password` w kontenerze: bez sprawdzania i doinstalowywania zależności.
ENV pnpm_config_verify_deps_before_run=false
# node_modules z CLI Prismy (migracje) i źródła potrzebne skryptom seed-admin i reset-password.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/prisma.config.ts ./
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src
USER node
EXPOSE 3000
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node scripts/seed-admin.ts && exec node .output/server/index.mjs"]
