FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY server/package.json server/package-lock.json* ./server/

# Install dependencies
RUN cd server && npm install --production

# Copy application code
COPY . .

EXPOSE 3000

CMD ["node", "server/index.js"]
