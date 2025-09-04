FROM oven/bun:1.1-alpine AS base
WORKDIR /usr/src/app

FROM base AS install
# Add system dependencies for @xenova/transformers
RUN apk --no-cache add \
    gcompat \
    libstdc++ \
    ca-certificates \
    curl

RUN mkdir -p /temp/dev
COPY rag-service/package.json /temp/dev/
RUN cd /temp/dev && bun install

RUN mkdir -p /temp/prod  
COPY rag-service/package.json /temp/prod/
RUN cd /temp/prod && bun install --production

FROM base AS prerelease
# Add system dependencies for runtime
RUN apk --no-cache add \
    gcompat \
    libstdc++

COPY --from=install /temp/dev/node_modules node_modules
COPY rag-service/ .

FROM base AS release
# Add system dependencies for runtime
RUN apk --no-cache add \
    gcompat \
    libstdc++ \
    ca-certificates \
    curl

COPY --from=install /temp/prod/node_modules node_modules
COPY --from=prerelease /usr/src/app .

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

USER bun

CMD ["bun", "--bun", "run", "src/index.ts"]