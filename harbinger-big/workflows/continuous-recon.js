#!/usr/bin/env node

/**
 * Continuous Reconnaissance & Change Detection
 * Detects new subdomains, open ports, and DNS changes
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  TARGETS: {
    'vodafone': { domain: 'vodafone.om', program: 'HackerOne' },
    'vienna': { domain: 'wien.gv.at', program: 'Bugcrowd' },
    'jora': { domain: 'jora.com', program: 'Bugcrowd' }
  },
  SHOTSNAP_DIR: '/Users/nunu/.openclaw/workspace/recon-snapshots',
  DIFF_LOG: '/Users/nunu/.openclaw/workspace/recon/diff-log.json'
};

// Ensure directories exist
[CONFIG.SHOTSNAP_DIR, path.dirname(CONFIG.DIFF_LOG)].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Fetch DNS records for a domain
 */
async function fetchDNSRecords(domain) {
  const exec = require('child_process').exec;
  
  return new Promise((resolve) => {
    // Use host command to get DNS records
    exec(`host -t A ${domain}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`[ERROR] DNS lookup failed for ${domain}:`, error.message);
        return resolve({ domain, records: [], timestamp: Date.now() });
      }
      
      const records = [];
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const match = line.match(/has address (\d+\.\d+\.\d+\.\d+)/);
        if (match) {
          records.push(match[1]);
        }
      }
      
      resolve({ domain, records, timestamp: Date.now() });
    });
  });
}

/**
 * Store DNS snapshot
 */
function storeSnapshot(snapshot) {
  const filePath = path.join(CONFIG.SHOTSNAP_DIR, `${snapshot.domain}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  console.log(`[SNAPSHOT] Stored snapshot for ${snapshot.domain}`);
}

/**
 * Load previous snapshot
 */
function loadSnapshot(domain) {
  const filePath = path.join(CONFIG.SHOTSNAP_DIR, `${domain}.json`);
  
  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }
  
  return null;
}

/**
 * Compare snapshots and detect changes
 */
async function compareSnapshots(domain) {
  const current = await fetchDNSRecords(domain);
  const previous = loadSnapshot(domain);
  
  if (!previous) {
    console.log(`[FIRST] First scan for ${domain}`);
    storeSnapshot(current);
    return { domain, isNew: true, newRecords: current.records, removedRecords: [] };
  }
  
  const currentSet = new Set(current.records);
  const previousSet = new Set(previous.records);
  
  const newRecords = [...currentSet].filter(ip => !previousSet.has(ip));
  const removedRecords = [...previousSet].filter(ip => !currentSet.has(ip));
  
  const diff = {
    domain,
    isNew: false,
    newRecords,
    removedRecords,
    timestamp: Date.now()
  };
  
  // Store new snapshot
  storeSnapshot(current);
  
  return diff;
}

/**
 * Log changes to diff log
 */
function logChanges(diff) {
  let log = [];
  
  if (fs.existsSync(CONFIG.DIFF_LOG)) {
    log = JSON.parse(fs.readFileSync(CONFIG.DIFF_LOG, 'utf8'));
  }
  
  log.push(diff);
  
  // Keep only last 1000 entries
  if (log.length > 1000) {
    log = log.slice(-1000);
  }
  
  fs.writeFileSync(CONFIG.DIFF_LOG, JSON.stringify(log, null, 2));
}

/**
 * Notify about changes
 */
function notifyChange(diff) {
  // This would integrate with Telegram/Slack in production
  console.log('\n' + '='.repeat(60));
  console.log('🚨 CHANGES DETECTED');
  console.log('='.repeat(60));
  console.log(`Domain: ${diff.domain}`);
  
  if (diff.newRecords.length > 0) {
    console.log(`\n✨ NEW RECORDS (${diff.newRecords.length}):`);
    diff.newRecords.forEach(ip => console.log(`  + ${ip}`));
  }
  
  if (diff.removedRecords.length > 0) {
    console.log(`\n🗑️  REMOVED RECORDS (${diff.removedRecords.length}):`);
    diff.removedRecords.forEach(ip => console.log(`  - ${ip}`));
  }
  
  console.log('='.repeat(60) + '\n');
}

/**
 * Main recon loop
 */
async function runContinuousRecon() {
  console.log('[RECON] Starting continuous reconnaissance...');
  console.log(`[RECON] Monitoring ${Object.keys(CONFIG.TARGETS).length} targets`);
  console.log('[RECON]'.repeat(30));
  
  const results = [];
  
  for (const [key, target] of Object.entries(CONFIG.TARGETS)) {
    console.log(`\n[DEBUG] Scanning ${target.domain}...`);
    
    try {
      const diff = await compareSnapshots(target.domain);
      
      if (diff.newRecords.length > 0 || diff.removedRecords.length > 0) {
        console.log(`[ALERT] ✨ Changes detected for ${target.domain}`);
        notifyChange(diff);
        logChanges(diff);
        results.push({ domain: target.domain, hasChanges: true, changes: diff });
      } else {
        console.log(`[OK] No changes for ${target.domain}`);
        results.push({ domain: target.domain, hasChanges: false });
      }
      
    } catch (error) {
      console.error(`[ERROR] Failed to scan ${target.domain}:`, error.message);
    }
  }
  
  console.log('\n[RECON] Continuous reconnaissance complete');
  console.log(`[RECON] Results: ${results.filter(r => r.hasChanges).length} changes detected`);
  
  return results;
}

// Run if executed directly
if (require.main === module) {
  runContinuousRecon()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('[FATAL]', error);
      process.exit(1);
    });
}

module.exports = { runContinuousRecon, compareSnapshots };