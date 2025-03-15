# Use a minimal Node.js image
FROM node:20-alpine AS builder

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Bundle app source
COPY . .

# Use a minimal Node.js image
FROM node:20-alpine

# Set the working directory
WORKDIR /app

# Copy the app from the builder image
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/  ./

# Expose the port the app runs on
EXPOSE 8080


# Serve the app
CMD ["node", "server.js"]
