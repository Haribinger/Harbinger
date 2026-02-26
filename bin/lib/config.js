/**
 * Harbinger CLI — Persistent Config
 *
 * Stores CLI state at ~/.harbinger/config.json so settings survive
 * across sessions (JWT cache, update timestamps, first-run flag).
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.harbinger');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const DEFAULTS = {
  apiBase: 'http://localhost:8080',
  frontendUrl: 'http://localhost:3000',
  jwt: '',
  jwtExpiry: 0,
  lastUpdateCheck: 0,
  firstRun: true,
  version: '',
};

export function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const raw = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch {
    // corrupted config — start fresh
  }
  return { ...DEFAULTS };
}

export function saveConfig(cfg) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2) + '\n');
}

export function getConfigValue(key) {
  const cfg = loadConfig();
  return cfg[key];
}

export function setConfigValue(key, value) {
  const cfg = loadConfig();
  cfg[key] = value;
  saveConfig(cfg);
}

export function isFirstRun() {
  return !fs.existsSync(CONFIG_FILE) || loadConfig().firstRun === true;
}

export function markSetupDone() {
  const cfg = loadConfig();
  cfg.firstRun = false;
  saveConfig(cfg);
}

/**
 * Check if an update check is due (once per 24 hours).
 */
export function isUpdateCheckDue() {
  const cfg = loadConfig();
  const ONE_DAY = 24 * 60 * 60 * 1000;
  return Date.now() - (cfg.lastUpdateCheck || 0) > ONE_DAY;
}

export function markUpdateChecked() {
  setConfigValue('lastUpdateCheck', Date.now());
}

export const CONFIG_DIR_PATH = CONFIG_DIR;
export const CONFIG_FILE_PATH = CONFIG_FILE;
