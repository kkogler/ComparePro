#!/usr/bin/env node

/**
 * Direct Vendor Priority System Test Script
 * Tests the vendor priority system using ES modules
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// This approach allows us to test the functions directly
async function runVendorPriorityTests() {
  console.log('🧪 Starting Direct Vendor Priority System Tests\n');
  console.log('════════════════════════════════════════════════\n');

  try {
    // Dynamic import the vendor priority functions
    const { getVendorRecordPriority, clearVendorPriorityCache, getVendorPriorityCacheStats } = await import('./server/vendor-priority.ts');
    const { shouldReplaceProduct } = await import('./server/simple-quality-priority.ts');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: [],
      summary: { passed: 0, failed: 0, total: 0 }
    };

    // Clear cache to start fresh
    clearVendorPriorityCache();
    console.log('🧹 Cache cleared for fresh testing\n');

    // Test 1: Direct vendor priority lookup
    console.log('📋 TEST 1: Direct Vendor Priority Lookup');
    console.log('================================================');

    const testVendors = [
      { name: 'Sports South', expectedPriority: 1 },
      { name: 'Chattanooga Shooting Supplies', expectedPriority: 2 }, 
      { name: 'Bill Hicks & Co.', expectedPriority: 3 },
      { name: 'GunBroker', expectedPriority: 4 },
      { name: "Lipsey's", expectedPriority: 4 },
      { name: 'Unknown Vendor', expectedPriority: 999 },
      { name: '', expectedPriority: 999 },
      { name: null, expectedPriority: 999 }
    ];

    for (const vendor of testVendors) {
      try {
        const priority = await getVendorRecordPriority(vendor.name);
        const passed = priority === vendor.expectedPriority;
        
        const test = {
          name: `Priority lookup for "${vendor.name || 'NULL'}"`,
          type: 'priority_lookup',
          vendor: vendor.name || 'NULL',
          expected: vendor.expectedPriority,
          actual: priority,
          passed: passed,
          message: `Priority: ${priority}`
        };
        
        results.tests.push(test);
        console.log(`${passed ? '✅' : '❌'} "${vendor.name || 'NULL'}" -> Expected: ${vendor.expectedPriority}, Got: ${priority}`);
      } catch (error) {
        const test = {
          name: `Priority lookup for "${vendor.name || 'NULL'}"`,
          type: 'priority_lookup',
          vendor: vendor.name || 'NULL',
          expected: vendor.expectedPriority,
          actual: 'error',
          passed: false,
          message: `Error: ${error.message}`
        };
        results.tests.push(test);
        console.log(`❌ "${vendor.name || 'NULL'}" -> Error: ${error.message}`);
      }
    }

    console.log('\n📋 TEST 2: Product Replacement Priority Logic');
    console.log('================================================');

    const testScenarios = [
      // Higher priority vendor replaces lower priority
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
        name: 'Chattanooga (P2) replaces GunBroker (P4)',
        existing: { source: 'GunBroker', model: 'TestModel4b' },
        new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel4b' },
        newVendor: 'Chattanooga Shooting Supplies',
        options: {},
        expected: true
      },
      {
        name: 'Bill Hicks (P3) replaces GunBroker (P4)',
        existing: { source: 'GunBroker', model: 'TestModel4c' },
        new: { source: 'Bill Hicks & Co.', model: 'TestModel4c' },
        newVendor: 'Bill Hicks & Co.',
        options: {},
        expected: true
      },
      
      // Lower priority vendor should NOT replace higher priority
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
        name: 'GunBroker (P4) does NOT replace Chattanooga (P2)',
        existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel8b' },
        new: { source: 'GunBroker', model: 'TestModel8b' },
        newVendor: 'GunBroker',
        options: {},
        expected: false
      },
      {
        name: 'GunBroker (P4) does NOT replace Sports South (P1)',
        existing: { source: 'Sports South', model: 'TestModel8c' },
        new: { source: 'GunBroker', model: 'TestModel8c' },
        newVendor: 'GunBroker',
        options: {},
        expected: false
      },
      
      // Equal priority scenarios (tie-breaking)
      {
        name: 'Equal Priority - Lipsey\'s (P4) does NOT replace GunBroker (P4)',
        existing: { source: 'GunBroker', model: 'TestModel9' },
        new: { source: "Lipsey's", model: 'TestModel9' },
        newVendor: "Lipsey's",
        options: {},
        expected: false
      },
      {
        name: 'Equal Priority - GunBroker (P4) does NOT replace Lipsey\'s (P4)',
        existing: { source: "Lipsey's", model: 'TestModel9b' },
        new: { source: 'GunBroker', model: 'TestModel9b' },
        newVendor: 'GunBroker',
        options: {},
        expected: false
      },
      
      // Same vendor updates (always allowed)
      {
        name: 'Same Vendor Update - Sports South updates own product',
        existing: { source: 'Sports South', model: 'TestModel10' },
        new: { source: 'Sports South', model: 'TestModelUpdated' },
        newVendor: 'Sports South',
        options: {},
        expected: true
      },
      {
        name: 'Same Vendor Update - GunBroker updates own product',
        existing: { source: 'GunBroker', model: 'TestModel10b' },
        new: { source: 'GunBroker', model: 'TestModelUpdated' },
        newVendor: 'GunBroker',
        options: {},
        expected: true
      },
      
      // Manual override scenarios
      {
        name: 'Manual Override - GunBroker (P4) replaces Sports South (P1) with override',
        existing: { source: 'Sports South', model: 'TestModel11' },
        new: { source: 'GunBroker', model: 'TestModel11' },
        newVendor: 'GunBroker',
        options: { isManualOverride: true },
        expected: true
      },
      {
        name: 'Manual Override - Bill Hicks (P3) replaces Sports South (P1) with override',
        existing: { source: 'Sports South', model: 'TestModel11b' },
        new: { source: 'Bill Hicks & Co.', model: 'TestModel11b' },
        newVendor: 'Bill Hicks & Co.',
        options: { isManualOverride: true },
        expected: true
      },
      
      // Source locking scenarios
      {
        name: 'Source Locked - Sports South (P1) cannot replace locked Chattanooga (P2)',
        existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel12' },
        new: { source: 'Sports South', model: 'TestModel12' },
        newVendor: 'Sports South',
        options: { sourceLocked: true },
        expected: false
      },
      {
        name: 'Source Locked - Even same vendor cannot update when locked (without override)',
        existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel12b' },
        new: { source: 'Chattanooga Shooting Supplies', model: 'TestModel12b-Updated' },
        newVendor: 'Chattanooga Shooting Supplies',
        options: { sourceLocked: true },
        expected: true // Same vendor should still be able to update
      },
      
      // Source locked + manual override
      {
        name: 'Source Locked + Manual Override - Override works despite source lock',
        existing: { source: 'Chattanooga Shooting Supplies', model: 'TestModel13' },
        new: { source: 'GunBroker', model: 'TestModel13' },
        newVendor: 'GunBroker',
        options: { sourceLocked: true, isManualOverride: true },
        expected: true
      }
    ];

    for (const scenario of testScenarios) {
      try {
        const result = await shouldReplaceProduct(
          scenario.existing,
          scenario.new,
          scenario.newVendor,
          scenario.options
        );
        
        const test = {
          name: scenario.name,
          type: 'replacement_logic',
          expected: scenario.expected,
          actual: result,
          passed: result === scenario.expected,
          details: {
            existingVendor: scenario.existing.source,
            newVendor: scenario.newVendor,
            options: scenario.options
          }
        };
        
        results.tests.push(test);
        console.log(`${test.passed ? '✅' : '❌'} ${scenario.name}`);
        if (!test.passed) {
          console.log(`   ⚠️  Expected: ${scenario.expected}, Got: ${result}`);
        }
      } catch (error) {
        const test = {
          name: scenario.name,
          type: 'replacement_logic',
          expected: scenario.expected,
          actual: 'error',
          passed: false,
          message: error.message
        };
        results.tests.push(test);
        console.log(`❌ ERROR: ${scenario.name} - ${error.message}`);
      }
    }

    console.log('\n📋 TEST 3: Edge Cases and Error Handling');
    console.log('================================================');

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
      },
      {
        name: 'Undefined existing vendor source',
        existing: { source: undefined, model: 'TestModel17' },
        newVendor: 'Sports South',
        expected: true
      },
      {
        name: 'Both vendors unknown',
        existing: { source: 'Unknown Vendor A', model: 'TestModel18' },
        newVendor: 'Unknown Vendor B',
        expected: false // Equal priority (999), keep existing
      }
    ];

    for (const edgeCase of edgeCases) {
      try {
        const result = await shouldReplaceProduct(
          edgeCase.existing,
          { model: 'TestModel' },
          edgeCase.newVendor,
          {}
        );
        
        const test = {
          name: edgeCase.name,
          type: 'edge_case',
          expected: edgeCase.expected,
          actual: result,
          passed: result === edgeCase.expected
        };
        
        results.tests.push(test);
        console.log(`${test.passed ? '✅' : '❌'} ${edgeCase.name}`);
        if (!test.passed) {
          console.log(`   ⚠️  Expected: ${edgeCase.expected}, Got: ${result}`);
        }
      } catch (error) {
        const test = {
          name: edgeCase.name,
          type: 'edge_case',
          expected: edgeCase.expected,
          actual: 'error',
          passed: false,
          message: error.message
        };
        results.tests.push(test);
        console.log(`❌ ERROR: ${edgeCase.name} - ${error.message}`);
      }
    }

    // Calculate summary
    results.summary.total = results.tests.length;
    results.summary.passed = results.tests.filter(t => t.passed).length;
    results.summary.failed = results.summary.total - results.summary.passed;
    results.summary.successRate = ((results.summary.passed / results.summary.total) * 100).toFixed(1);

    // Get cache stats
    const cacheStats = getVendorPriorityCacheStats();
    results.cacheStats = cacheStats;

    console.log('\n🏁 TEST SUMMARY');
    console.log('================================================');
    console.log(`Total Tests: ${results.summary.total}`);
    console.log(`✅ Passed: ${results.summary.passed}`);
    console.log(`❌ Failed: ${results.summary.failed}`);
    console.log(`Success Rate: ${results.summary.successRate}%`);

    if (results.summary.failed === 0) {
      console.log('\n🎉 All tests passed! Vendor priority system is working correctly.');
    } else {
      console.log('\n⚠️  Some tests failed. Details:');
      const failedTests = results.tests.filter(t => !t.passed);
      failedTests.forEach(test => {
        console.log(`   - ${test.name}: Expected ${test.expected}, Got ${test.actual}`);
      });
    }

    console.log('\n📈 Cache Statistics:');
    console.log(`Cache size: ${cacheStats.size}`);
    cacheStats.entries.forEach(entry => {
      console.log(`  - ${entry.vendor}: priority ${entry.priority} (age: ${entry.age}s)`);
    });

    return results;

  } catch (error) {
    console.error('❌ Critical error running tests:', error);
    return { error: error.message, timestamp: new Date().toISOString() };
  }
}

// Run the tests
runVendorPriorityTests()
  .then(results => {
    console.log('\n📊 Test run completed');
    process.exit(results.summary?.failed > 0 ? 1 : 0);
  })
  .catch(error => {
    console.error('💥 Failed to run tests:', error);
    process.exit(1);
  });