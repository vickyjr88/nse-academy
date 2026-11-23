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

# The NSE API's address is bundled into the Admin panel only so it can recognise calls to route through Strapi's proxy.
# Do NOT add the admin key here: everything in the bundle is public. The key is a runtime variable (docker-compose.yml).
ARG STRAPI_ADMIN_NSE_API_URL
ARG PUBLIC_URL=https://admin.nseacademy.co.ke
ENV PUBLIC_URL=$PUBLIC_URL
ENV STRAPI_ADMIN_NSE_API_URL=$STRAPI_ADMIN_NSE_API_URL

# Build the Strapi admin panel and server
RUN npm run build

EXPOSE 1337

# Start Strapi
CMD ["npm", "run", "start"]
