FROM node:22-alpine

WORKDIR /usr/src/app

# Install system dependencies for Prisma
RUN apk add --no-cache openssl libc6-compat

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

EXPOSE 3011

# Start the application with database sync
CMD ["sh", "-c", "npx prisma db push && npm run start:prod"]
