#!/usr/bin/env node

/**
 * Nose Roast Release Build Script
 * Generates optimized AAB for Google Play Console
 * Version: 2.0.0
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

// Read current version from package.json
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const currentVersion = packageJson.version;

console.log(`
╔══════════════════════════════════════════════════════════╗
║           Nose Roast - Release Build Script              ║
║                    Version ${currentVersion.padEnd(10)}           ║
╚══════════════════════════════════════════════════════════╝
`);

// Parse version components
const [major, minor, patch] = currentVersion.split('.').map(Number);
const versionCode = major * 10000 + minor * 100 + patch;

console.log(`📦 Building version: ${currentVersion}`);
console.log(`🔢 Version code: ${versionCode}`);
console.log('');

try {
  // Step 1: Clean and build web app
  console.log('🧹 Cleaning previous builds...');
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
  }
  if (fs.existsSync('android/app/build')) {
    fs.rmSync('android/app/build', { recursive: true });
  }

  console.log('🔨 Building optimized web app...');
  execSync('npm run build', { stdio: 'inherit' });

  // Step 2: Sync with Capacitor
  console.log('📱 Syncing with Capacitor...');
  execSync('npx cap sync android', { stdio: 'inherit' });

  // Step 3: Update Android version
  console.log('⚙️  Updating Android version codes...');
  const buildGradlePath = 'android/app/build.gradle';
  let buildGradle = fs.readFileSync(buildGradlePath, 'utf8');

  // Update versionCode and versionName
  buildGradle = buildGradle.replace(
    /versionCode \d+/,
    `versionCode ${versionCode}`
  );
  buildGradle = buildGradle.replace(
    /versionName "[^"]+"/,
    `versionName "${currentVersion}"`
  );

  fs.writeFileSync(buildGradlePath, buildGradle);
  console.log(`   ✓ versionCode: ${versionCode}`);
  console.log(`   ✓ versionName: "${currentVersion}"`);

  // Step 4: Build AAB
  console.log('🏗️  Building Android App Bundle (AAB)...');
  process.chdir('android');
  execSync('.\\gradlew.bat bundleRelease', { stdio: 'inherit' });
  process.chdir('..');

  // Step 5: Verify output
  const aabPath = `android/app/build/outputs/bundle/release/app-release.aab`;
  if (fs.existsSync(aabPath)) {
    const stats = fs.statSync(aabPath);
    const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

    console.log('');
    console.log('✅ Build successful!');
    console.log('');
    console.log(`📁 Output: ${aabPath}`);
    console.log(`📊 Size: ${sizeMB} MB`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Test the AAB on a real device');
    console.log('  2. Upload to Google Play Console');
    console.log('  3. Update release notes');
    console.log('');
  } else {
    console.error('❌ Build failed: AAB not found');
    process.exit(1);
  }

} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
