# Development stage
FROM node:20-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

RUN npx prisma generate

COPY . .

# Build stage
FROM node:20-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/
COPY --from=development /usr/src/app/node_modules ./node_modules

COPY . .

RUN npm run build

# Generate contracts and OpenAPI specification for runtime access
RUN npm run extract:contracts:standalone
RUN npm run generate:openapi

RUN NODE_ENV=production npm ci --only=production && npm cache clean --force

RUN npx prisma generate

# Production stage
FROM node:20-alpine AS production

WORKDIR /usr/src/app

COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/generated ./generated
COPY package*.json ./
COPY prisma ./prisma/

EXPOSE 3000

CMD ["node", "dist/src/main"]