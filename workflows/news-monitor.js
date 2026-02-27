#!/usr/bin/env node

/**
 * Security News & Community Intel
 * Fetches bug bounty and vulnerability news from Hacker News
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  HN_API_BASE: 'https://hacker-news.firebaseio.com/v0',
  KEYWORDS: [
    'bug bounty',
    'vulnerability',
    'CVE',
    'RCE',
    'zero-day',
    'exploit',
    'security',
    'penetration testing',
    'xss',
    'sql injection',
    'authentication bypass',
    'privilege escalation',
    'path traversal'
  ],
  NEWS_FILE: path.join(process.env.HARBINGER_WORKSPACE || path.join(require('os').homedir(), '.harbinger/workspace'), 'recon/security-news.json'),
  MAX_STORIES: 50
};

/**
 * Fetch top story IDs from Hacker News
 */
async function fetchTopStories() {
  return new Promise((resolve, reject) => {
    https.get(`${CONFIG.HN_API_BASE}/topstories.json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
      res.on('error', reject);
    });
  });
}

/**
 * Fetch details for a specific story
 */
async function fetchStoryDetails(storyId) {
  return new Promise((resolve, reject) => {
    https.get(`${CONFIG.HN_API_BASE}/item/${storyId}.json`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (error) {
          reject(error);
        }
      });
      res.on('error', reject);
    });
  });
}

/**
 * Check if story matches keywords
 */
function matchesKeywords(story) {
  const text = [
    story.title || '',
    story.text || '',
    story.url || ''
  ].join(' ').toLowerCase();
  
  return CONFIG.KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
}

/**
 * Score story relevance
 */
function scoreStory(story) {
  let score = 0;
  const text = (story.title || '').toLowerCase();
  
  // High-value keywords
  if (text.includes('zero-day')) score += 10;
  if (text.includes('rce')) score += 9;
  if (text.includes('cve-') || text.includes('cve ')) score += 8;
  if (text.includes('exploit')) score += 7;
  if (text.includes('authentication bypass')) score += 7;
  
  // Medium-value keywords
  if (text.includes('vulnerability')) score += 5;
  if (text.includes('bug bounty')) score += 5;
  if (text.includes('security')) score += 3;
  
  // Engagement factor
  score += Math.min(story.score || 0, 100) / 10;
  
  // Recency boost (stories from last 24h)
  const hoursSince = (Date.now() - (story.time * 1000)) / (1000 * 60 * 60);
  if (hoursSince < 24) score += 5;
  
  return Math.round(score * 10) / 10;
}

/**
 * Fetch relevant security news
 */
async function fetchSecurityNews() {
  console.log('[NEWS] Fetching security news from Hacker News...');
  
  try {
    // Get top story IDs
    console.log('[NEWS] Fetching top stories...');
    const storyIds = await fetchTopStories();
    console.log(`[NEWS] Retrieved ${storyIds.length} story IDs`);
    
    // Fetch details for top stories
    const relevantStories = [];
    const checkedCount = Math.min(storyIds.length, CONFIG.MAX_STORIES);
    
    console.log(`[NEWS] Checking ${checkedCount} stories for relevance...`);
    
    for (let i = 0; i < checkedCount; i++) {
      const storyId = storyIds[i];
      
      try {
        const story = await fetchStoryDetails(storyId);
        
        if (matchesKeywords(story)) {
          story.relevanceScore = scoreStory(story);
          story.fetchedAt = Date.now();
          relevantStories.push(story);
          console.log(`[OK] ✓ "${story.title}" (score: ${story.relevanceScore})`);
        }
        
      } catch (error) {
        console.error(`[ERROR] Failed to fetch story ${storyId}:`, error.message);
      }
    }
    
    // Sort by relevance score
    relevantStories.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    console.log(`\n[NEWS] Found ${relevantStories.length} relevant stories`);
    console.log(`[NEWS] Top 5 stories:`);
    
    relevantStories.slice(0, 5).forEach((story, i) => {
      console.log(`  ${i + 1}. [${story.relevanceScore}] ${story.title}`);
    });
    
    // Save news to file
    fs.writeFileSync(
      CONFIG.NEWS_FILE,
      JSON.stringify({
        fetchedAt: Date.now(),
        totalChecked: checkedCount,
        relevantCount: relevantStories.length,
        stories: relevantStories
      }, null, 2)
    );
    
    console.log(`[NEWS] Saved news to ${CONFIG.NEWS_FILE}`);
    
    return relevantStories;
    
  } catch (error) {
    console.error('[ERROR] Failed to fetch security news:', error);
    return [];
  }
}

/**
 * Display news summary
 */
function displayNewsSummary(stories) {
  if (stories.length === 0) {
    console.log('\n[NEWS] No relevant stories found');
    return;
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('📰 SECURITY NEWS SUMMARY');
  console.log('='.repeat(80));
  
  stories.slice(0, 10).forEach((story, i) => {
    const time = new Date(story.time * 1000).toLocaleString();
    const url = story.url || `https://news.ycombinator.com/item?id=${story.id}`;
    
    console.log(`\n${i + 1}. ${story.title}`);
    console.log(`   Score: ${story.score} | Relevance: ${story.relevanceScore}`);
    console.log(`   Time: ${time}`);
    console.log(`   URL: ${url}`);
    
    if (story.text) {
      console.log(`   ${story.text.substring(0, 200)}...`);
    }
  });
  
  console.log('\n' + '='.repeat(80));
}

/**
 * Main execution
 */
async function main() {
  const stories = await fetchSecurityNews();
  displayNewsSummary(stories);
  return stories;
}

// Run if executed directly
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('[FATAL]', error);
      process.exit(1);
    });
}

module.exports = { fetchSecurityNews };