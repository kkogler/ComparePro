#!/usr/bin/env node

/**
 * Debug Code Cleanup Script
 * Removes debug console.log statements, TODO comments, and test code from production files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Patterns to remove or replace
const debugPatterns = [
  // Console.log statements
  {
    pattern: /console\.log\([^)]*\);?\s*\n?/g,
    replacement: '',
    description: 'Console.log statements'
  },
  // Debug comments
  {
    pattern: /\/\/\s*DEBUG:.*$/gm,
    replacement: '',
    description: 'DEBUG comments'
  },
  // Debug blocks
  {
    pattern: /\/\*\*\*\s*DEBUG:[\s\S]*?\*\*\*\//g,
    replacement: '',
    description: 'DEBUG comment blocks'
  },
  // Test/debug code blocks
  {
    pattern: /if\s*\(\s*productsProcessed\s*<=\s*\d+\s*\)\s*\{[\s\S]*?\}/g,
    replacement: '',
    description: 'Debug limit blocks'
  },
  // Console.log with debug prefixes
  {
    pattern: /console\.log\(['"`]\*\*\*.*?\*\*\*['"`][^)]*\);?\s*\n?/g,
    replacement: '',
    description: 'Debug console.log with asterisks'
  }
];

// Files to exclude from cleanup
const excludePatterns = [
  /node_modules/,
  /\.git/,
  /dist/,
  /build/,
  /\.deprecated/,
  /test-/,
  /debug/,
  /scripts\/cleanup/,
  /\.md$/,
  /\.json$/,
  /\.csv$/,
  /\.txt$/
];

// File extensions to process
const targetExtensions = ['.ts', '.js', '.tsx', '.jsx'];

let totalFiles = 0;
let modifiedFiles = 0;
let totalReplacements = 0;

/**
 * Check if file should be excluded
 */
function shouldExcludeFile(filePath) {
  return excludePatterns.some(pattern => pattern.test(filePath));
}

/**
 * Check if file has target extension
 */
function hasTargetExtension(filePath) {
  return targetExtensions.some(ext => filePath.endsWith(ext));
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let fileReplacements = 0;

    // Apply all debug patterns
    debugPatterns.forEach(({ pattern, replacement, description }) => {
      const matches = modifiedContent.match(pattern);
      if (matches) {
        modifiedContent = modifiedContent.replace(pattern, replacement);
        fileReplacements += matches.length;
        console.log(`  ✓ Removed ${matches.length} ${description}`);
      }
    });

    // Only write if content changed
    if (modifiedContent !== content) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      modifiedFiles++;
      totalReplacements += fileReplacements;
      console.log(`  📝 Modified: ${fileReplacements} replacements`);
    }

    return fileReplacements;
  } catch (error) {
    console.error(`  ❌ Error processing ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Recursively process directory
 */
function processDirectory(dirPath) {
  const items = fs.readdirSync(dirPath);
  
  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!shouldExcludeFile(fullPath)) {
        processDirectory(fullPath);
      }
    } else if (stat.isFile()) {
      if (hasTargetExtension(fullPath) && !shouldExcludeFile(fullPath)) {
        totalFiles++;
        console.log(`\n🔍 Processing: ${path.relative(projectRoot, fullPath)}`);
        const replacements = processFile(fullPath);
        if (replacements === 0) {
          console.log(`  ✅ No debug code found`);
        }
      }
    }
  }
}

/**
 * Main cleanup function
 */
function main() {
  console.log('🧹 Starting Debug Code Cleanup...\n');
  console.log('📁 Project root:', projectRoot);
  console.log('🎯 Target extensions:', targetExtensions.join(', '));
  console.log('🚫 Excluded patterns:', excludePatterns.map(p => p.toString()).join(', '));
  console.log('\n' + '='.repeat(60));
  
  const startTime = Date.now();
  
  // Process server directory first (most debug code)
  const serverDir = path.join(projectRoot, 'server');
  if (fs.existsSync(serverDir)) {
    console.log('\n📂 Processing server directory...');
    processDirectory(serverDir);
  }
  
  // Process client directory
  const clientDir = path.join(projectRoot, 'client');
  if (fs.existsSync(clientDir)) {
    console.log('\n📂 Processing client directory...');
    processDirectory(clientDir);
  }
  
  // Process shared directory
  const sharedDir = path.join(projectRoot, 'shared');
  if (fs.existsSync(sharedDir)) {
    console.log('\n📂 Processing shared directory...');
    processDirectory(sharedDir);
  }
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 Cleanup Complete!');
  console.log(`📊 Files processed: ${totalFiles}`);
  console.log(`📝 Files modified: ${modifiedFiles}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  if (modifiedFiles > 0) {
    console.log('\n⚠️  IMPORTANT: Please test your application after cleanup!');
    console.log('   Run: npm run dev');
    console.log('   Check for any broken functionality');
  } else {
    console.log('\n✅ No debug code found - your codebase is clean!');
  }
}

// Run the cleanup
main();

























