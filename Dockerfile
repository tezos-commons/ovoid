# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static bundle ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

# Production OAuth needs the hosted client_id + redirect URI baked in at build
# time (Vite inlines import.meta.env.VITE_* during `vite build`). Pass them with
# --build-arg; harmless to omit for a dev/loopback build.
#   docker build \
#     --build-arg VITE_CLIENT_ID=https://app.example/client-metadata.json \
#     --build-arg VITE_REDIRECT_URI=https://app.example/oauth/callback -t ovoid .
ARG VITE_CLIENT_ID=""
ARG VITE_REDIRECT_URI=""
ENV VITE_CLIENT_ID=$VITE_CLIENT_ID
ENV VITE_REDIRECT_URI=$VITE_REDIRECT_URI

COPY . .
RUN npm run build

# ---------- Stage 2: serve with nginx on :8080 ----------
FROM nginx:alpine AS serve

# SPA history-API fallback + asset caching, listening on 8080.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
