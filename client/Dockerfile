FROM node:18-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Copy the rest of the application
COPY . .

EXPOSE 3000

CMD ["npm", "start"] 