FROM node:22-alpine

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Set build-time environments (Next.js inlines NEXT_PUBLIC_* into the client
# bundle at build time, so they must be ARGs not just runtime env).
ARG NEXT_PUBLIC_API_URL=https://nseacademy-api.vitaldigitalmedia.net
ARG NEXT_PUBLIC_CMS_URL=https://nseacademy-admin.vitaldigitalmedia.net
ARG NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
ARG NEXT_PUBLIC_POSTHOG_KEY=
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL
ENV NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=$NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# Build the Next.js application
RUN npm run build

EXPOSE 3010

# Start the application
CMD ["npm", "run", "start"]
