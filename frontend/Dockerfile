# Stage 1: Build the React Application
FROM node:20-alpine AS builder

WORKDIR /workspace

# Copy dependency configs
COPY package.json ./

# Install packages
RUN npm install

# Copy application code
COPY . .

# Build production React application bundle
RUN npm run build

# Stage 2: Serve using high-performance Nginx
FROM nginx:alpine

# Copy built React files from Stage 1 into Nginx static assets directory
COPY --from=builder /workspace/dist /usr/share/nginx/html

# Expose Nginx server port
EXPOSE 80

# Run Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
