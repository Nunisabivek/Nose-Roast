#!/usr/bin/env node

/**
 * Nose Roast Version Bump Script
 * Updates version in package.json and syncs to Android
 */

import fs from 'fs';
import { execSync } from 'child_process';

const bumpType = process.argv[2] || 'patch'; // major, minor, or patch

if (!['major', 'minor', 'patch'].includes(bumpType)) {
  console.error('Usage: node scripts/bump-version.js [major|minor|patch]');
  process.exit(1);
}

// Read current version
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const currentVersion = packageJson.version;
const [major, minor, patch] = currentVersion.split('.').map(Number);

// Calculate new version
let newMajor = major;
let newMinor = minor;
let newPatch = patch;

switch (bumpType) {
  case 'major':
    newMajor++;
    newMinor = 0;
    newPatch = 0;
    break;
  case 'minor':
    newMinor++;
    newPatch = 0;
    break;
  case 'patch':
    newPatch++;
    break;
}

const newVersion = `${newMajor}.${newMinor}.${newPatch}`;
const versionCode = newMajor * 10000 + newMinor * 100 + newPatch;

console.log(`Bumping version: ${currentVersion} → ${newVersion}`);

// Update package.json
packageJson.version = newVersion;
fs.writeFileSync('./package.json', JSON.stringify(packageJson, null, 2) + '\n');

// Update App.tsx version constant
const appTsxPath = './App.tsx';
let appTsx = fs.readFileSync(appTsxPath, 'utf8');
appTsx = appTsx.replace(
  /const APP_VERSION = '[^']+';/,
  `const APP_VERSION = '${newVersion}';`
);
appTsx = appTsx.replace(
  /const BUILD_DATE = '[^']+';/,
  `const BUILD_DATE = '${new Date().toISOString().split('T')[0]}';`
);
fs.writeFileSync(appTsxPath, appTsx);

// Update Android build.gradle if it exists
const buildGradlePath = './android/app/build.gradle';
if (fs.existsSync(buildGradlePath)) {
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');
  buildGradle = buildGradle.replace(
    /versionCode \d+/,
    `versionCode ${versionCode}`
  );
  buildGradle = buildGradle.replace(
    /versionName "[^"]+"/,
    `versionName "${newVersion}"`
  );
  fs.writeFileSync(buildGradlePath, buildGradle);
}

console.log(`✅ Version updated to ${newVersion}`);
console.log(`   Version code: ${versionCode}`);
console.log('');
console.log('Next: Run "npm run build:release" to create AAB');
