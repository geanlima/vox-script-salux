FROM node:22-alpine

WORKDIR /app

COPY package.json ./
COPY package-lock.json ./
RUN apk add --no-cache --virtual .build-deps python3 make g++ \
	&& npm ci --omit=dev \
	&& apk del .build-deps

COPY src ./src

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "start"]
