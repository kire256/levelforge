const fs = require('fs');
const { execSync } = require('child_process');

// Get git commit hash
let commit = 'unknown';
try {
  commit = execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
} catch (e) {
  console.log('Could not get git commit hash');
}

// Generate build number based on date and commit
const now = new Date();
const year = now.getFullYear();
const month = String(now.getMonth() + 1).padStart(2, '0');
const day = String(now.getDate()).padStart(2, '0');
const hour = String(now.getHours()).padStart(2, '0');
const minute = String(now.getMinutes()).padStart(2, '0');

const buildVersion = `${year}.${month}.${day}-${hour}${minute}`;
const buildTime = now.toISOString();

const content = `// Auto-generated during build - DO NOT EDIT
export const BUILD_VERSION = '${buildVersion}';
export const BUILD_COMMIT = '${commit}';
export const BUILD_TIME = '${buildTime}';
`;

fs.writeFileSync('src/version.js', content);
console.log(`Generated build version: ${buildVersion} (${commit})`);
