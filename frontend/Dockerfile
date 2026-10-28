# Development image: keep Vite/HMR for local docker-compose usage.
FROM node:20-alpine AS development

WORKDIR /app

COPY package*.json ./
RUN HUSKY=0 npm ci

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host"]


# Build stage: dev tooling (Vite/esbuild) is needed only to produce static assets.
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN HUSKY=0 npm ci

COPY . .

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build


# Production/runtime image: ship only compiled assets, not node_modules or
# build-time binaries such as esbuild. This materially reduces the attack
# surface and prevents build-tool CVEs from appearing in the runtime image.
FROM nginx:stable-alpine AS production

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
