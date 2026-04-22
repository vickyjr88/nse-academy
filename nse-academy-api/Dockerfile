FROM node:22-alpine

WORKDIR /usr/src/app

# Install system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

EXPOSE 3011

# Start the application - baseline existing schema then deploy new migrations
CMD ["sh", "-c", "npx prisma migrate resolve --applied 0_init && npx prisma migrate deploy && npm run start:prod"]
