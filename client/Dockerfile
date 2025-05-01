# Client Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package.json yarn.lock ./

# Install dependencies
RUN yarn install --production

# Copy all files
COPY . .

# Build the app
RUN yarn build

# Serve the static files
CMD ["yarn", "start"]
