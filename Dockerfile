FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY api ./api
COPY problem_doc ./problem_doc
COPY public ./public
RUN npm ci && npm run build && npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/problem_doc ./problem_doc
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["npm", "start"]
