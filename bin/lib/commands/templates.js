/**
 * harbinger reset / diff — Template management commands.
 * Extracted from the original monolithic cli.js.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { C, ICON } from '../ui.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageDir = path.join(__dirname, '..', '..', '..');
const templatesDir = path.join(packageDir, 'templates');

const EXCLUDED_FILENAMES = ['CLAUDE.md'];

function destPath(templateRelPath) {
  if (templateRelPath.endsWith('.template')) {
    return templateRelPath.slice(0, -'.template'.length);
  }
  return templateRelPath;
}

function templatePath(userPath) {
  const withSuffix = userPath + '.template';
  if (fs.existsSync(path.join(templatesDir, withSuffix))) {
    return withSuffix;
  }
  return userPath;
}

function getTemplateFiles() {
  const files = [];
  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (!EXCLUDED_FILENAMES.includes(entry.name)) {
        files.push(path.relative(templatesDir, fullPath));
      }
    }
  }
  if (fs.existsSync(templatesDir)) walk(templatesDir);
  return files;
}

function copyDirSyncForce(src, dest, templateRelBase = '') {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (EXCLUDED_FILENAMES.includes(entry.name)) continue;
    const srcPath = path.join(src, entry.name);
    const templateRel = templateRelBase ? path.join(templateRelBase, entry.name) : entry.name;
    const outName = path.basename(destPath(templateRel));
    const destFile = path.join(dest, outName);
    if (entry.isDirectory()) {
      copyDirSyncForce(srcPath, destFile, templateRel);
    } else {
      fs.copyFileSync(srcPath, destFile);
      console.log(`  ${ICON.ok} Restored ${path.relative(process.cwd(), destFile)}`);
    }
  }
}

export function reset(filePath) {
  const cwd = process.cwd();

  if (!filePath) {
    console.log('\n  Available template files:\n');
    const files = getTemplateFiles();
    for (const file of files) {
      console.log(`    ${C.dim(destPath(file))}`);
    }
    console.log(`\n  Usage: ${C.gold('harbinger reset <file>')}`);
    console.log(`  Example: ${C.gold('harbinger reset config/SOUL.md')}\n`);
    return;
  }

  const tmplPath = templatePath(filePath);
  const src = path.join(templatesDir, tmplPath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\n  ${ICON.fail} Template not found: ${filePath}`);
    console.log(`  Run ${C.gold('harbinger reset')} to see available templates.\n`);
    process.exit(1);
  }

  if (fs.statSync(src).isDirectory()) {
    console.log(`\n  Restoring ${filePath}/...\n`);
    copyDirSyncForce(src, dest, tmplPath);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`\n  ${ICON.ok} Restored ${filePath}\n`);
  }
}

export function diff(filePath) {
  const cwd = process.cwd();

  if (!filePath) {
    console.log('\n  Files that differ from package templates:\n');
    const files = getTemplateFiles();
    let anyDiff = false;
    for (const file of files) {
      const src = path.join(templatesDir, file);
      const outPath = destPath(file);
      const dest = path.join(cwd, outPath);
      if (fs.existsSync(dest)) {
        const srcContent = fs.readFileSync(src);
        const destContent = fs.readFileSync(dest);
        if (!srcContent.equals(destContent)) {
          console.log(`    ${C.warn(outPath)}`);
          anyDiff = true;
        }
      } else {
        console.log(`    ${C.danger(outPath)} (missing)`);
        anyDiff = true;
      }
    }
    if (!anyDiff) {
      console.log(`    ${ICON.ok} All files match package templates.`);
    }
    console.log(`\n  Usage: ${C.gold('harbinger diff <file>')}`);
    console.log(`  Example: ${C.gold('harbinger diff config/SOUL.md')}\n`);
    return;
  }

  const tmplPath = templatePath(filePath);
  const src = path.join(templatesDir, tmplPath);
  const dest = path.join(cwd, filePath);

  if (!fs.existsSync(src)) {
    console.error(`\n  ${ICON.fail} Template not found: ${filePath}`);
    process.exit(1);
  }

  if (!fs.existsSync(dest)) {
    console.log(`\n  ${filePath} does not exist in your project.`);
    console.log(`  Run ${C.gold(`harbinger reset ${filePath}`)} to create it.\n`);
    return;
  }

  try {
    execSync(`git diff --no-index -- "${dest}" "${src}"`, { stdio: 'inherit' });
    console.log('\n  Files are identical.\n');
  } catch {
    console.log(`\n  To reset: ${C.gold(`harbinger reset ${filePath}`)}\n`);
  }
}
