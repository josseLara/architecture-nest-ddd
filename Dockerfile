# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.21.0

# ---------------------------------------------------------------------------
# Dependencies (includes dev dependencies, required to compile TypeScript)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS dependencies

ENV SCARF_ANALYTICS=false

WORKDIR /usr/src/app

RUN --mount=type=bind,source=package.json,target=package.json \
    --mount=type=bind,source=package-lock.json,target=package-lock.json \
    --mount=type=cache,target=/root/.npm \
    npm ci

# ---------------------------------------------------------------------------
# Build (Nest -> dist) and keep only production dependencies
# ---------------------------------------------------------------------------
FROM dependencies AS build

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npm run build \
    && npm prune --omit=dev

# ---------------------------------------------------------------------------
# Runtime (minimal image, non-root user)
# ---------------------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS production

ENV NODE_ENV=production \
    PORT=3000

WORKDIR /usr/src/app

COPY --from=build --chown=node:node /usr/src/app/package.json ./package.json
COPY --from=build --chown=node:node /usr/src/app/node_modules ./node_modules
COPY --from=build --chown=node:node /usr/src/app/dist ./dist
COPY --chown=node:node data ./data

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "const port = process.env.PORT || 3000; fetch('http://127.0.0.1:' + port + '/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1));"]

CMD ["node", "dist/main.js"]
