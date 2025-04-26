FROM node:18-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

COPY package*.json ./

RUN npm install
RUN npm install react-youtube

COPY . .

EXPOSE 3000

CMD ["npm", "start"] 