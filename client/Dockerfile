FROM node:18-alpine

WORKDIR /app

# Install wget for health checks
RUN apk add --no-cache wget

COPY package*.json ./

# Install dependencies including react-youtube
RUN npm install && \
    npm install react-youtube --save

COPY . .

EXPOSE 3000

CMD ["npm", "start"] 