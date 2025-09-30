#!/usr/bin/env node

/**
 * Safe Cleanup Script
 * More conservative approach to removing debug code without breaking functionality
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Safe patterns to remove (only obvious debug code)
const safeDebugPatterns = [
  // Only remove console.log with obvious debug prefixes
  {
    pattern: /console\.log\(['"`]\*\*\*.*?\*\*\*['"`][^)]*\);?\s*\n?/g,
    replacement: '',
    description: 'Debug console.log with asterisks'
  },
  // Remove obvious debug comments
  {
    pattern: /\/\/\s*DEBUG:.*$/gm,
    replacement: '',
    description: 'DEBUG comments'
  },
  // Remove debug blocks
  {
    pattern: /\/\*\*\*\s*DEBUG:[\s\S]*?\*\*\*\//g,
    replacement: '',
    description: 'DEBUG comment blocks'
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
  /scripts/,
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
 * Process a single file with safe patterns only
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let fileReplacements = 0;

    // Apply only safe debug patterns
    safeDebugPatterns.forEach(({ pattern, replacement, description }) => {
      const matches = modifiedContent.match(pattern);
      if (matches) {
        modifiedContent = modifiedContent.replace(pattern, replacement);
        fileReplacements += matches.length;
      }
    });

    // Only write if content changed
    if (modifiedContent !== content) {
      fs.writeFileSync(filePath, modifiedContent, 'utf8');
      modifiedFiles++;
      totalReplacements += fileReplacements;
      return fileReplacements;
    }

    return 0;
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
        console.log(`🔍 Processing: ${path.relative(projectRoot, fullPath)}`);
        const replacements = processFile(fullPath);
        if (replacements > 0) {
          console.log(`  📝 Removed ${replacements} debug items`);
        } else {
          console.log(`  ✅ No debug code found`);
        }
      }
    }
  }
}

/**
 * Create a simple logging replacement guide
 */
function createLoggingGuide() {
  const guide = `# Logging Migration Guide

## Replace Console.log with Structured Logging

### 1. Import the logger
\`\`\`typescript
import { logger } from './lib/logger';
\`\`\`

### 2. Replace console.log statements
\`\`\`typescript
// Old
console.log('Sync started');
console.log('Processing product:', product);

// New
logger.info('Sync started', { syncType: 'full' });
logger.debug('Processing product', { productId: product.id, name: product.name });
\`\`\`

### 3. Use appropriate log levels
- \`logger.debug()\` - Detailed debugging information
- \`logger.info()\` - General information
- \`logger.warn()\` - Warning messages
- \`logger.error()\` - Error messages

### 4. Add context to logs
\`\`\`typescript
// Good
logger.info('User login', { userId: user.id, email: user.email });

// Avoid
logger.info('User login');
\`\`\`

## Benefits
- ✅ Structured logging with context
- ✅ Log levels for filtering
- ✅ Production-ready logging
- ✅ Better debugging capabilities
`;

  const guidePath = path.join(projectRoot, 'LOGGING_MIGRATION_GUIDE.md');
  fs.writeFileSync(guidePath, guide, 'utf8');
  console.log('📖 Created logging migration guide: LOGGING_MIGRATION_GUIDE.md');
}

/**
 * Main cleanup function
 */
function main() {
  console.log('🧹 Safe Cleanup Script');
  console.log('=====================\n');
  
  const startTime = Date.now();
  
  // Process server directory
  console.log('📂 Processing server directory...\n');
  processDirectory(path.join(projectRoot, 'server'));
  
  // Process client directory
  console.log('\n📂 Processing client directory...\n');
  processDirectory(path.join(projectRoot, 'client/src'));
  
  // Process shared directory
  console.log('\n📂 Processing shared directory...\n');
  processDirectory(path.join(projectRoot, 'shared'));
  
  // Create logging guide
  console.log('\n📝 Creating logging migration guide...\n');
  createLoggingGuide();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Safe Cleanup Complete!');
  console.log(`📊 Files processed: ${totalFiles}`);
  console.log(`📝 Files modified: ${modifiedFiles}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  if (modifiedFiles > 0) {
    console.log('\n⚠️  IMPORTANT: Please test your application!');
    console.log('   1. Run: npm run check');
    console.log('   2. Run: npm run dev');
    console.log('   3. Check all functionality');
    console.log('   4. Review logging migration guide');
  } else {
    console.log('\n✅ No debug code found - your codebase is clean!');
  }
}

// Run the cleanup
main();

























