# syntax=docker/dockerfile:1

# ---------- Stage 1: build the static bundle ----------
FROM node:22-alpine AS build
WORKDIR /app

# Install deps first for layer caching.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# OAuth client_id == the URL of the hosted client-metadata.json, and the atproto
# auth server requires that document's own `client_id` to equal the URL it's
# fetched from. The app derives the client_id from window.location.origin at
# runtime, so the only build-time concern is baking the deploy origin into the
# static metadata file. Defaults to the production domain; override to retarget:
#   docker build --build-arg APP_ORIGIN=https://staging.ovoid.at -t ovoid .
ARG APP_ORIGIN=https://ovoid.at
RUN sed -i "s#https://ovoid.at#${APP_ORIGIN}#g" public/client-metadata.json

RUN npm run build

# ---------- Stage 2: serve with nginx on :8080 ----------
FROM nginx:alpine AS serve

# SPA history-API fallback + asset caching, listening on 8080.
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
