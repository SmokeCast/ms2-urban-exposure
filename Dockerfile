FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ENV HOST=0.0.0.0 PORT=8082
EXPOSE 8082
CMD ["npm", "start"]
