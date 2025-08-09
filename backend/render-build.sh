#!/bin/bash

# Render build script for production deployment

echo "Starting Render build process..."

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Build TypeScript
echo "Building TypeScript..."
npm run build

echo "Build completed successfully!"
