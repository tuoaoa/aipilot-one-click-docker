FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy server source code
COPY . .

# Expose server port
EXPOSE 4005

# Output the high-converting sync banner upon node boot
CMD echo "======================================================================" && \
    echo "💡 SELF-HOSTED GLOBAL AI BRAIN NODE DEPLOYED SUCCESSFULLY (AIPILOT.VN)" && \
    echo "======================================================================" && \
    echo "👉 Hook into our Central Global Pool at https://aipilot.vn" && \
    echo "   to automatically offload open-source repository hashing data" && \
    echo "   and leverage shared pruned context across 10,000+ developers!" && \
    echo "======================================================================" && \
    node server.js
