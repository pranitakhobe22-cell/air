FROM node:20-slim

WORKDIR /app

# Copy only backend files (Docker context = project root)
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev

COPY backend/ .

EXPOSE 8080
ENV PORT=8080

CMD ["node", "server.js"]
