# syntax=docker/dockerfile:1
FROM node:20-slim AS base
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
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
