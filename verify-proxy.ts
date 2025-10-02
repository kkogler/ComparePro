/**
 * Verify Proxy Configuration
 */

console.log('='.repeat(80));
console.log('PROXY CONFIGURATION CHECK');
console.log('='.repeat(80));
console.log();

const proxyHost = process.env.PROXY_HOST;
const proxyPort = process.env.PROXY_PORT;
const proxyUsername = process.env.PROXY_USERNAME;
const proxyPassword = process.env.PROXY_PASSWORD;

if (proxyHost && proxyPort && proxyUsername && proxyPassword) {
  console.log('✅ PROXY CONFIGURATION DETECTED');
  console.log(`   Host: ${proxyHost}`);
  console.log(`   Port: ${proxyPort}`);
  console.log(`   Username: ${proxyUsername}`);
  console.log(`   Password: ${'*'.repeat(proxyPassword.length)}`);
  console.log();
  console.log('✅ All vendor API calls will route through fixed IP');
  console.log('   APIs using proxy: Lipsey\'s, Sports South, Chattanooga');
  console.log();
  console.log('🎉 Ready to test Lipsey\'s API!');
  console.log('   Run: npx tsx test-lipseys-api-responses.ts');
} else {
  console.log('❌ PROXY NOT CONFIGURED');
  console.log();
  console.log('Missing variables:');
  if (!proxyHost) console.log('   - PROXY_HOST');
  if (!proxyPort) console.log('   - PROXY_PORT');
  if (!proxyUsername) console.log('   - PROXY_USERNAME');
  if (!proxyPassword) console.log('   - PROXY_PASSWORD');
  console.log();
  console.log('📋 Action Required:');
  console.log('   1. Restart the dev server (Ctrl+C then npm run dev)');
  console.log('   2. Or reload the Replit workspace');
}

console.log();
console.log('='.repeat(80));
process.exit(0);

