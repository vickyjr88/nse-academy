FROM node:22-alpine

# Install build dependencies for native modules (like sharp)
RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev > /dev/null 2>&1

WORKDIR /opt/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set environment to production for build
ENV NODE_ENV=production

# These must be passed as build args to be bundled into the Admin panel
ARG STRAPI_ADMIN_NSE_API_URL
ARG STRAPI_ADMIN_NSE_KEY
ENV STRAPI_ADMIN_NSE_API_URL=$STRAPI_ADMIN_NSE_API_URL
ENV STRAPI_ADMIN_NSE_KEY=$STRAPI_ADMIN_NSE_KEY

# Build the Strapi admin panel and server
RUN npm run build

EXPOSE 1337

# Start Strapi
CMD ["npm", "run", "start"]
