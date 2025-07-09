# Build stage
FROM node:20-slim AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy the entire workspace
COPY . .

# Run the pnpm commands as specified
RUN pnpm -F backend... install
RUN pnpm -F backend... generate
RUN pnpm -F backend... build
RUN echo "inject-workspace-packages=true" >> ./.npmrc
RUN pnpm -F backend exec -- npm pkg set pnpm.patchedDependencies='{"@polar-sh/better-auth@1.0.4": "patches/@polar-sh__better-auth@1.0.4.patch"}' --json
RUN mkdir backend/patches/
RUN cp -r patches/* backend/patches/
RUN pnpm -F backend... install --no-frozen-lockfile
# Update package.json main fields to point to dist folders
RUN pnpm -F "./packages/*" exec -- npm pkg set main=dist/index.js
RUN pnpm -F backend deploy --prod ./pruned
RUN cp -Lr ./backend/node_modules/prisma-client/* ./pruned/node_modules/prisma-client

# Production stage
FROM node:20-slim AS production

WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl

# Copy the pruned output from the build stage
COPY --from=builder /app/pruned .

EXPOSE 8080
CMD ["npm", "start"]