/**
 * Comprehensive Vendor Priority System Test Script
 * Tests the vendor priority lookup and product replacement logic
 */

import { getVendorRecordPriority, clearVendorPriorityCache, getVendorPriorityCacheStats } from './server/vendor-priority.js';
import { shouldReplaceProduct } from './server/simple-quality-priority.js';

console.log('🧪 Starting Vendor Priority System Tests\n');

// Test 1: Direct vendor priority lookup
console.log('📋 TEST 1: Direct Vendor Priority Lookup');
console.log('================================================');

const testVendors = [
  'Sports South',
  'Chattanooga Shooting Supplies', 
  'Bill Hicks & Co.',
  'GunBroker',
  "Lipsey's",
  'Unknown Vendor',
  '',
  null
];

console.log('Testing vendor priority lookups...\n');

for (const vendor of testVendors) {
  try {
    const priority = await getVendorRecordPriority(vendor);
    console.log(`✅ "${vendor || 'NULL'}" -> Priority: ${priority}`);
  } catch (error) {
    console.log(`❌ "${vendor || 'NULL'}" -> Error: ${error.message}`);
  }
}

console.log('\n📋 TEST 2: Cache Functionality');
console.log('================================================');

// Test cache stats
console.log('Cache stats after initial lookups:');
const cacheStats = getVendorPriorityCacheStats();
console.log(`Cache size: ${cacheStats.size}`);
cacheStats.entries.forEach(entry => {
  console.log(`  - ${entry.vendor}: priority ${entry.priority} (age: ${entry.age}s)`);
});

// Test cache clearing
clearVendorPriorityCache();
console.log('\n✅ Cache cleared');

const cacheStatsAfterClear = getVendorPriorityCacheStats();
console.log(`Cache size after clear: ${cacheStatsAfterClear.size}\n`);

console.log('📋 TEST 3: Product Replacement Priority Logic');
console.log('================================================');

// Test scenarios for product replacement
const testScenarios = [
  {
    name: 'Sports South (P1) replaces Chattanooga (P2)',
    existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel1' },
    new: { source: 'Sports South', model: 'TestModel1' },
    newVendor: 'Sports South',
    options: {},
    expected: true
  },
  {
    name: 'Sports South (P1) replaces Bill Hicks (P3)', 
    existing: { source: 'Bill Hicks & Co.', model: 'TestModel2' },
    new: { source: 'Sports South', model: 'TestModel2' },
    newVendor: 'Sports South',
    options: {},
    expected: true
  },
  {
    name: 'Sports South (P1) replaces GunBroker (P4)',
    existing: { source: 'GunBroker', model: 'TestModel3' },
    new: { source: 'Sports South', model: 'TestModel3' },
    newVendor: 'Sports South',
    options: {},
    expected: true
  },
  {
    name: 'Chattanooga (P2) replaces Bill Hicks (P3)',
    existing: { source: 'Bill Hicks & Co.', model: 'TestModel4' },
    new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel4' },
    newVendor: 'Chattanooga Shooting Supplies',
    options: {},
    expected: true
  },
  {
    name: 'Chattanooga (P2) does NOT replace Sports South (P1)',
    existing: { source: 'Sports South', model: 'TestModel5' },
    new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel5' },
    newVendor: 'Chattanooga Shooting Supplies',
    options: {},
    expected: false
  },
  {
    name: 'Bill Hicks (P3) does NOT replace Sports South (P1)',
    existing: { source: 'Sports South', model: 'TestModel6' },
    new: { source: 'Bill Hicks & Co.', model: 'TestModel6' },
    newVendor: 'Bill Hicks & Co.',
    options: {},
    expected: false
  },
  {
    name: 'Bill Hicks (P3) does NOT replace Chattanooga (P2)',
    existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel7' },
    new: { source: 'Bill Hicks & Co.', model: 'TestModel7' },
    newVendor: 'Bill Hicks & Co.',
    options: {},
    expected: false
  },
  {
    name: 'GunBroker (P4) does NOT replace Bill Hicks (P3)',
    existing: { source: 'Bill Hicks & Co.', model: 'TestModel8' },
    new: { source: 'GunBroker', model: 'TestModel8' },
    newVendor: 'GunBroker',
    options: {},
    expected: false
  },
  {
    name: 'Equal Priority - Lipsey\'s (P4) does NOT replace GunBroker (P4)',
    existing: { source: 'GunBroker', model: 'TestModel9' },
    new: { source: "Lipsey's", model: 'TestModel9' },
    newVendor: "Lipsey's",
    options: {},
    expected: false
  },
  {
    name: 'Same Vendor Update - Sports South updates own product',
    existing: { source: 'Sports South', model: 'TestModel10' },
    new: { source: 'Sports South', model: 'TestModelUpdated' },
    newVendor: 'Sports South',
    options: {},
    expected: true
  },
  {
    name: 'Manual Override - GunBroker (P4) replaces Sports South (P1) with override',
    existing: { source: 'Sports South', model: 'TestModel11' },
    new: { source: 'GunBroker', model: 'TestModel11' },
    newVendor: 'GunBroker',
    options: { isManualOverride: true },
    expected: true
  },
  {
    name: 'Source Locked - Sports South (P1) cannot replace locked Chattanooga (P2)',
    existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel12' },
    new: { source: 'Sports South', model: 'TestModel12' },
    newVendor: 'Sports South',
    options: { sourceLocked: true },
    expected: false
  },
  {
    name: 'Source Locked + Manual Override - Override works despite source lock',
    existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel13' },
    new: { source: 'GunBroker', model: 'TestModel13' },
    newVendor: 'GunBroker',
    options: { sourceLocked: true, isManualOverride: true },
    expected: true
  }
];

console.log(`Testing ${testScenarios.length} replacement scenarios...\n`);

let passed = 0;
let failed = 0;

for (const scenario of testScenarios) {
  try {
    const result = await shouldReplaceProduct(
      scenario.existing,
      scenario.new,
      scenario.newVendor,
      scenario.options
    );
    
    if (result === scenario.expected) {
      console.log(`✅ PASS: ${scenario.name}`);
      console.log(`   Expected: ${scenario.expected}, Got: ${result}\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${scenario.name}`);
      console.log(`   Expected: ${scenario.expected}, Got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${scenario.name}`);
    console.log(`   Error: ${error.message}\n`);
    failed++;
  }
}

console.log('📋 TEST 4: Edge Cases and Error Handling');
console.log('================================================');

// Test edge cases
const edgeCases = [
  {
    name: 'Unknown vendor replacement attempt',
    existing: { source: 'Sports South', model: 'TestModel14' },
    newVendor: 'Unknown Vendor XYZ',
    expected: false // Unknown vendor gets priority 999, shouldn't replace priority 1
  },
  {
    name: 'Empty string vendor source',
    existing: { source: 'Sports South', model: 'TestModel15' },
    newVendor: '',
    expected: false
  },
  {
    name: 'Null existing vendor source',
    existing: { source: null, model: 'TestModel16' },
    newVendor: 'Sports South',
    expected: true // Unknown existing (priority 999) should be replaced by Sports South (priority 1)
  }
];

console.log(`Testing ${edgeCases.length} edge cases...\n`);

for (const edgeCase of edgeCases) {
  try {
    const result = await shouldReplaceProduct(
      edgeCase.existing,
      { model: 'TestModel' },
      edgeCase.newVendor,
      {}
    );
    
    if (result === edgeCase.expected) {
      console.log(`✅ PASS: ${edgeCase.name}`);
      console.log(`   Expected: ${edgeCase.expected}, Got: ${result}\n`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${edgeCase.name}`);
      console.log(`   Expected: ${edgeCase.expected}, Got: ${result}\n`);
      failed++;
    }
  } catch (error) {
    console.log(`❌ ERROR: ${edgeCase.name}`);
    console.log(`   Error: ${error.message}\n`);
    failed++;
  }
}

console.log('🏁 TEST SUMMARY');
console.log('================================================');
console.log(`Total Tests: ${passed + failed}`);
console.log(`✅ Passed: ${passed}`);
console.log(`❌ Failed: ${failed}`);
console.log(`Success Rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);

if (failed === 0) {
  console.log('\n🎉 All tests passed! Vendor priority system is working correctly.');
} else {
  console.log('\n⚠️  Some tests failed. Review the implementation.');
}

// Final cache stats
console.log('\n📈 Final Cache Statistics:');
const finalCacheStats = getVendorPriorityCacheStats();
console.log(`Cache size: ${finalCacheStats.size}`);
finalCacheStats.entries.forEach(entry => {
  console.log(`  - ${entry.vendor}: priority ${entry.priority} (age: ${entry.age}s)`);
});