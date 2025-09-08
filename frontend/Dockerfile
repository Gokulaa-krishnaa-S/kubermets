# Use official Node image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install
ENV VITE_API_BASE_URL=/environment-api-2/v1
ENV VITE_PUBLIC_KEYCLOAK_ENABLED=false
ENV VITE_PUBLIC_KEYCLOAK_URL=https://kclab.cloudinfinit.com/auth
ENV VITE_PUBLIC_KEYCLOAK_REALM=sify-model-realm
ENV VITE_PUBLIC_KEYCLOAK_CLIENT_ID=sify-ai-platform
ENV VITE_PUBLIC_DISABLE_KEYCLOAK_IN_IFRAME=false

# Backend API Configuration
ENV PUBLIC_BACKEND_API_BASE_URL=/environment-api/api
ENV VITE_BACKEND_API_BASE_URL=/environment-api/api
ENV VITE_PUBLIC_CLUSTER_CREATION_METHOD=1

COPY . .

RUN npm run build

# Use Nginx to serve the static files
# # FROM nginx:alpine
# COPY --from=build /app/dist /usr/share/nginx/html

# Optional: remove default nginx config and copy your own
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 4173

CMD ["npm", "run", "preview"]
