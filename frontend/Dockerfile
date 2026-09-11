FROM node:22-alpine AS build
WORKDIR /src
ARG VITE_MAPBOX_TOKEN
ENV VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN
COPY frontend/package.json frontend/package-lock.json* ./
COPY frontend/ .
RUN npm install && npm run build

FROM nginx:1.27-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/dist /usr/share/nginx/html
