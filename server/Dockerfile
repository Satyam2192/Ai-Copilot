FROM node:18-alpine

# Create app directory
WORKDIR /app

# Copy environment variables
COPY .env ./

# Install dependencies
COPY package.json yarn.lock ./
RUN yarn install --production

# Copy application code
COPY . .

# Expose port from .env
EXPOSE ${PORT}

# Start application
CMD ["node", "app.js"]
