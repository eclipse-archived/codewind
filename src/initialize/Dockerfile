FROM node:current-alpine
RUN apk update && apk upgrade && \
    apk add --no-cache unzip
COPY ./package.json /app/package.json
COPY ./package-lock.json /app/package-lock.json
WORKDIR /app
RUN npm ci
COPY ./ /app
RUN npm run build && \
    rm -rf src
CMD node out/main.js
