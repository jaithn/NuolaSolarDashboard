# syntax=docker/dockerfile:1
FROM node:24-slim AS base
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
# --legacy-peer-deps: einige Pakete (z.B. recharts 2.x) listen React 19 noch
# nicht in ihren peerDependencies, obwohl es faktisch kompatibel ist - ohne
# dieses Flag bricht npm mit ERESOLVE ab statt nur zu warnen.
# --ignore-scripts: das "postinstall"-Skript (prisma generate) braucht
# prisma/schema.prisma, das in diesem Stage noch nicht kopiert ist - die
# Builder-Stage unten ruft "prisma generate" nach dem vollstaendigen
# "COPY . ." ohnehin explizit auf.
RUN npm install --legacy-peer-deps --ignore-scripts

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
# gosu: erlaubt dem als root gestarteten Entrypoint, nach dem Anpassen der
# Volume-Rechte auf einen unprivilegierten User herunterzuschalten.
RUN apt-get update -y && apt-get install -y gosu && rm -rf /var/lib/apt/lists/*
# WICHTIG: node_modules aus der BUILDER-Stage (nicht deps): nur dort ist der
# Prisma-Client generiert (deps installiert mit --ignore-scripts). Mit den
# deps-node_modules wuerde der Worker beim Start mit "@prisma/client did not
# initialize yet" abstuerzen.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
# src/ + tsconfig.json: der Worker (Shelly-Polling) laeuft in diesem Image
# als zweiter Prozess direkt aus den TypeScript-Quellen via "tsx" (siehe
# docker-entrypoint.sh) statt als eigenes Image - tsconfig.json wird fuer
# die "@/*"-Pfad-Aliase benoetigt.
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./tsconfig.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Volume-Verzeichnisse anlegen. Der Container startet als root, damit der
# Entrypoint die (bei Bind-Mounts oft fremd-owned) Volume-Ordner dem Ziel-User
# uebereignen kann - danach wird per gosu auf PUID:PGID (Default 1000:1000,
# auf Unraid z.B. 99:100) heruntergeschaltet, sodass die App unprivilegiert
# laeuft. Ohne diese Laufzeit-Anpassung scheitert SQLite auf Unraid mit
# "attempt to write a readonly database".
RUN mkdir -p /app/data /app/public/uploads

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
