# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY client/package*.json ./
RUN npm ci

COPY client/ .
RUN npm run build

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]