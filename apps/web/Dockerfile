FROM oven/bun:1 AS development
WORKDIR /app

COPY package.json ./
RUN bun install

COPY . .

EXPOSE 3000
ENV HOSTNAME=0.0.0.0
CMD ["bun", "run", "dev", "--", "--hostname", "0.0.0.0", "--port", "3000"]

FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json ./
RUN bun install --frozen-lockfile || bun install

FROM oven/bun:1 AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run build

FROM oven/bun:1 AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
EXPOSE 3000
CMD ["bun", "run", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
