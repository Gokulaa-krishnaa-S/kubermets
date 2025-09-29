# Use official Node image
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

# Copy app source
COPY . .

# Make entrypoint.sh executable
RUN chmod +x /app/entrypoint.sh

# Build the app
RUN npm run build

EXPOSE 4173

# Use entrypoint.sh to inject env vars at runtime, then start the app
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["npm", "run", "preview"]
