FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html

RUN rm -f /usr/share/nginx/html/Dockerfile \
          /usr/share/nginx/html/docker-compose*.yml \
          /usr/share/nginx/html/nginx.conf \
          /usr/share/nginx/html/.env* \
          /usr/share/nginx/html/server.js \
          /usr/share/nginx/html/package*.json \
          /usr/share/nginx/html/.github

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget -qO- http://localhost/ || exit 1
