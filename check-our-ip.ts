import fetch from 'node-fetch';

async function checkOurIP() {
  console.log('Checking our outbound IP address...\n');
  
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json() as any;
    console.log('🌍 Our public IP address:', data.ip);
    console.log('\n📋 Please verify with Lipsey\'s that THIS IP is whitelisted:', data.ip);
  } catch (error: any) {
    console.error('Error:', error.message);
  }
  
  process.exit(0);
}

checkOurIP();

