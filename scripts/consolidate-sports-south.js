#!/usr/bin/env node

/**
 * Sports South Consolidation Script
 * Removes redundant Sports South implementations and updates imports
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Files to remove (redundant implementations)
const filesToRemove = [
  'server/sports-south-simple-sync.ts',
  'server/sports-south-catalog-sync-old.ts',
  'server/sports-south-bulk-update.ts',
  'server/sports-south-chunked-update.ts',
  'server/sports-south-fulltext-bulk-update.ts',
  'server/sports-south-schedule-routes.ts',
  'sports-south-scheduled-sync.ts'
];

// Files to update (replace imports)
const filesToUpdate = [
  'server/routes.ts',
  'server/index.ts',
  'server/vendor-registry.ts'
];

// Import replacements
const importReplacements = [
  {
    from: "import { SportsSouthCatalogSyncService } from './sports-south-catalog-sync'",
    to: "import { SportsSouthService } from './sports-south-unified-service'"
  },
  {
    from: "import { performSportsSouthCatalogSync } from './sports-south-simple-sync'",
    to: "import { SportsSouthService } from './sports-south-unified-service'"
  },
  {
    from: "import { SportsSouthScheduler } from './sports-south-scheduler'",
    to: "import { SportsSouthService } from './sports-south-unified-service'"
  }
];

// Function replacements
const functionReplacements = [
  {
    from: "new SportsSouthCatalogSyncService(",
    to: "new SportsSouthService("
  },
  {
    from: "performSportsSouthCatalogSync(",
    to: "new SportsSouthService(credentials).performMappingOnlySync()"
  },
  {
    from: "new SportsSouthScheduler()",
    to: "new SportsSouthService(credentials)"
  }
];

let removedFiles = 0;
let updatedFiles = 0;
let totalReplacements = 0;

/**
 * Remove redundant files
 */
function removeRedundantFiles() {
  console.log('🗑️  Removing redundant Sports South files...\n');
  
  for (const filePath of filesToRemove) {
    const fullPath = path.join(projectRoot, filePath);
    
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        removedFiles++;
        console.log(`  ✅ Removed: ${filePath}`);
      } catch (error) {
        console.log(`  ❌ Failed to remove ${filePath}:`, error.message);
      }
    } else {
      console.log(`  ⚠️  File not found: ${filePath}`);
    }
  }
}

/**
 * Update file imports and function calls
 */
function updateFileImports(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let fileReplacements = 0;
    let modified = false;

    // Apply import replacements
    importReplacements.forEach(({ from, to }) => {
      if (content.includes(from)) {
        content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
        fileReplacements++;
        modified = true;
      }
    });

    // Apply function replacements
    functionReplacements.forEach(({ from, to }) => {
      if (content.includes(from)) {
        content = content.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), to);
        fileReplacements++;
        modified = true;
      }
    });

    if (modified) {
      fs.writeFileSync(filePath, content, 'utf8');
      updatedFiles++;
      totalReplacements += fileReplacements;
      console.log(`  📝 Updated: ${fileReplacements} replacements`);
    } else {
      console.log(`  ✅ No changes needed`);
    }

    return fileReplacements;
  } catch (error) {
    console.log(`  ❌ Error updating ${filePath}:`, error.message);
    return 0;
  }
}

/**
 * Update all files that import Sports South services
 */
function updateAllFiles() {
  console.log('\n📝 Updating imports and function calls...\n');
  
  for (const filePath of filesToUpdate) {
    const fullPath = path.join(projectRoot, filePath);
    
    if (fs.existsSync(fullPath)) {
      console.log(`🔍 Processing: ${filePath}`);
      updateFileImports(fullPath);
    } else {
      console.log(`⚠️  File not found: ${filePath}`);
    }
  }
}

/**
 * Create migration guide
 */
function createMigrationGuide() {
  const guide = `# Sports South Consolidation Migration Guide

## What Changed

### Removed Files
${filesToRemove.map(file => `- \`${file}\``).join('\n')}

### New Unified Service
- **File**: \`server/sports-south-unified-service.ts\`
- **Class**: \`SportsSouthService\`
- **Features**: Full catalog sync, incremental sync, mapping-only sync, scheduling

## Migration Steps

### 1. Update Imports
Replace old imports with:
\`\`\`typescript
import { SportsSouthService } from './sports-south-unified-service';
\`\`\`

### 2. Update Service Usage
\`\`\`typescript
// Old way
const syncService = new SportsSouthCatalogSyncService(credentials);
await syncService.performFullCatalogSync();

// New way
const service = new SportsSouthService(credentials);
await service.performFullCatalogSync();
\`\`\`

### 3. Available Methods
- \`performFullCatalogSync()\` - Full catalog sync
- \`performIncrementalSync()\` - Incremental updates
- \`performMappingOnlySync()\` - Create UPC→ITEMNO mappings only
- \`startScheduledSync()\` - Start scheduled sync
- \`stopScheduledSync()\` - Stop scheduled sync
- \`getSyncStatus()\` - Get sync status

## Benefits
- ✅ Single service for all Sports South operations
- ✅ Consistent error handling
- ✅ Unified result interface
- ✅ Built-in scheduling
- ✅ Reduced code duplication
- ✅ Easier maintenance

## Testing
After migration, test:
1. Full catalog sync
2. Incremental sync
3. Scheduled sync
4. Error handling
5. Status reporting
`;

  const guidePath = path.join(projectRoot, 'SPORTS_SOUTH_CONSOLIDATION_GUIDE.md');
  fs.writeFileSync(guidePath, guide, 'utf8');
  console.log(`\n📖 Created migration guide: SPORTS_SOUTH_CONSOLIDATION_GUIDE.md`);
}

/**
 * Main consolidation function
 */
function main() {
  console.log('🔄 Sports South Consolidation Script');
  console.log('=====================================\n');
  
  const startTime = Date.now();
  
  // Step 1: Remove redundant files
  removeRedundantFiles();
  
  // Step 2: Update imports and function calls
  updateAllFiles();
  
  // Step 3: Create migration guide
  createMigrationGuide();
  
  const endTime = Date.now();
  const duration = ((endTime - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Sports South Consolidation Complete!');
  console.log(`📊 Files removed: ${removedFiles}`);
  console.log(`📝 Files updated: ${updatedFiles}`);
  console.log(`🔄 Total replacements: ${totalReplacements}`);
  console.log(`⏱️  Duration: ${duration}s`);
  
  console.log('\n⚠️  IMPORTANT: Please test your application after consolidation!');
  console.log('   1. Check all Sports South functionality');
  console.log('   2. Verify scheduled syncs work');
  console.log('   3. Test error handling');
  console.log('   4. Review migration guide');
}

// Run the consolidation
main();

























