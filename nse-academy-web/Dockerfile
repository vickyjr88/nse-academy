FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build-time environments (Next.js needs some for static generation)
ARG NEXT_PUBLIC_API_URL=http://localhost:3011
ARG NEXT_PUBLIC_CMS_URL=http://localhost:1337
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL

# Build the Next.js application
RUN npm run build

EXPOSE 3010

# Start the application
CMD ["npm", "run", "start"]
