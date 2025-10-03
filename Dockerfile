FROM mcr.microsoft.com/playwright:v1.41.2-focal

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Install playwright browsers
RUN npx playwright install chromium

# Make the run script executable
RUN chmod +x run-test.sh

# Run the test
CMD ["./run-test.sh"]

