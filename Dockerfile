# Use official Node.js runtime as base image
FROM node:24-alpine

# Install FFmpeg which is required for RTSP stream processing
RUN apk add --no-cache ffmpeg

# Set working directory in container
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose the port the app runs on
EXPOSE 3000

# Health check to ensure the app is running
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Start the application (running as root to avoid permission issues)
CMD ["npm", "start"]