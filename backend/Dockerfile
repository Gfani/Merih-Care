# --- Build Stage ---
FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:18-alpine AS production

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/tsconfig.json ./tsconfig.json

# If migrations/seeding require source files or ts-node, copy src and tsconfig
COPY --from=build /app/src ./src

ENV NODE_ENV=production

EXPOSE 3000

# Run migrations and start the application
CMD npm run migration:run && npm run start:prod
