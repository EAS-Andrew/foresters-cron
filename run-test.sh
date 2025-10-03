#!/bin/sh
node -e "console.log(\`[FORESTERS EVENT CHECK] Started at \${new Date().toISOString()}\`)"
cd /app && npx playwright test tests/test-1.spec.ts
node -e "console.log(\`[FORESTERS EVENT CHECK] Completed at \${new Date().toISOString()}\`)"
