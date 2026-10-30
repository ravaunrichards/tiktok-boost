FROM node:22-alpine AS build
WORKDIR /app
RUN npm install --global pnpm@9.12.3
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/catalog/package.json packages/catalog/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/catalog packages/catalog
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN npm install --global pnpm@9.12.3
COPY --from=build /app /app
EXPOSE 10000
CMD ["pnpm","--filter","@tikboost/api","start"]
