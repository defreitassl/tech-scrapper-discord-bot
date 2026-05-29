FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run prisma:generate
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "prod"]
