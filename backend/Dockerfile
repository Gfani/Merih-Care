# --- Build Stage ---
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json .npmrc* ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production Stage ---
FROM node:20-alpine AS production

WORKDIR /app

COPY package*.json .npmrc* ./
RUN npm ci --only=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/tsconfig.json ./tsconfig.json

# If migrations/seeding require source files or ts-node, copy src and tsconfig
COPY --from=build /app/src ./src

ENV NODE_ENV=production
ENV UPLOADS_DIR=/app/uploads
ENV RESEND_FROM_EMAIL="Merihcare <otp@merihcare.live>"
ENV TEXTBEE_DEVICE_ID=6aa4825b0eb03ef4ba0872f6
ENV TEXTBEE_API_KEY=txb_LB6z9cmtuXWqCfjMQWCzxBrrjaSfsAej

RUN mkdir -p /app/uploads/credentials && chmod -R 777 /app/uploads

EXPOSE 3000

# Start the production application (TypeORM auto-runs migrations on connect)
CMD ["node", "dist/main"]
