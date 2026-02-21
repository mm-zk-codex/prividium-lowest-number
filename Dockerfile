# ---- build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Install deps (better layer caching)
COPY frontend/package.json frontend/package-lock.json*  ./

# Pick the right installer based on lockfile presence
RUN npm ci

# Copy source and build
COPY . .

ARG VITE_CHAIN_ID
ARG VITE_RPC_URL
ARG VITE_PRIVIDIUM_CLIENT_ID
ARG VITE_AUTH_BASE_URL
ARG VITE_PRIVIDIUM_API_BASE_URL
ARG VITE_GAME_ADDRESS

ENV VITE_CHAIN_ID=${VITE_CHAIN_ID}
ENV VITE_RPC_URL=${VITE_RPC_URL}
ENV VITE_PRIVIDIUM_CLIENT_ID=${VITE_PRIVIDIUM_CLIENT_ID}
ENV VITE_AUTH_BASE_URL=${VITE_AUTH_BASE_URL}
ENV VITE_PRIVIDIUM_API_BASE_URL=${VITE_PRIVIDIUM_API_BASE_URL}
ENV VITE_GAME_ADDRESS=${VITE_GAME_ADDRESS}

RUN cd frontend && npm run build
  
# ---- serve stage ----
FROM nginx:alpine AS serve

# Replace default nginx site config with SPA-friendly config
COPY nginx/default.conf /etc/nginx/conf.d/default.conf

# Copy build output
COPY --from=build /app/frontend/dist /usr/share/nginx/html

EXPOSE 80

# Simple healthcheck endpoint served by nginx
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1