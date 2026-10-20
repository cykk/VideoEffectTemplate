FROM node:20-bookworm-slim AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable && corepack prepare pnpm@10.13.1 --activate

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.json tsconfig.base.json next.config.ts drizzle.config.ts trigger.config.ts ./
COPY apps/api/package.json apps/api/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=deps /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=deps /app/.npmrc ./.npmrc
COPY --from=deps /app/tsconfig.json ./tsconfig.json
COPY --from=deps /app/tsconfig.base.json ./tsconfig.base.json
COPY --from=deps /app/next.config.ts ./next.config.ts
COPY --from=deps /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=deps /app/trigger.config.ts ./trigger.config.ts
COPY . .

ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-api

RUN pnpm exec next build ./apps/api

FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_DIST_DIR=.next-api
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app /app

RUN chmod +x /app/tools/yt-dlp/linux/yt-dlp \
  && /app/tools/yt-dlp/linux/yt-dlp --version

EXPOSE 3001

CMD ["pnpm", "exec", "next", "start", "./apps/api", "--hostname", "0.0.0.0", "--port", "3001"]
