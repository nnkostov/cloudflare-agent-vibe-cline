#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Automatic Versioning System (Two-Part: MAJOR.MINOR)
 * Each deploy bumps MINOR. MAJOR reserved for breaking changes.
 */

// Version bump types
const VERSION_TYPES = {
  MINOR: 'minor',
  MAJOR: 'major'
};

// Commit message patterns for version detection
const COMMIT_PATTERNS = {
  [VERSION_TYPES.MAJOR]: [
    /BREAKING[\s\S]*CHANGE/i,
    /^breaking[\s\S]*:/i,
    /^major[\s\S]*:/i
  ]
};

class AutoVersioner {
  constructor() {
    this.rootPackagePath = path.join(process.cwd(), 'package.json');
    this.dashboardPackagePath = path.join(process.cwd(), 'dashboard', 'package.json');
  }

  /**
   * Get current version from package.json
   */
  getCurrentVersion() {
    try {
      const packageJson = JSON.parse(fs.readFileSync(this.rootPackagePath, 'utf8'));
      return packageJson.version;
    } catch (error) {
      console.error('Error reading package.json:', error.message);
      process.exit(1);
    }
  }

  /**
   * Get git commits since last version tag
   */
  getCommitsSinceLastVersion() {
    try {
      // Get the last version tag
      let lastTag;
      try {
        lastTag = execSync('git describe --tags --abbrev=0 --match="v*"', { encoding: 'utf8' }).trim();
      } catch (error) {
        // No tags found, get all commits
        console.log('No previous version tags found, analyzing all commits');
        lastTag = null;
      }

      // Get commits since last tag (or all commits if no tag)
      const gitCommand = lastTag
        ? `git log ${lastTag}..HEAD --oneline --no-merges`
        : 'git log --oneline --no-merges -10'; // Last 10 commits if no tags

      const commits = execSync(gitCommand, { encoding: 'utf8' })
        .trim()
        .split('\n')
        .filter(line => line.length > 0);

      console.log(`Found ${commits.length} commits since ${lastTag || 'beginning'}`);

      if (commits.length > 0) {
        console.log('Recent commits:');
        commits.slice(0, 5).forEach(commit => {
          console.log(`   ${commit}`);
        });
        if (commits.length > 5) {
          console.log(`   ... and ${commits.length - 5} more`);
        }
      }

      return commits;
    } catch (error) {
      console.error('Error getting git commits:', error.message);
      return [];
    }
  }

  /**
   * Analyze commits to determine version bump type
   */
  analyzeCommits(commits) {
    let hasMajor = false;
    const majorCommits = [];

    commits.forEach(commit => {
      if (COMMIT_PATTERNS[VERSION_TYPES.MAJOR].some(pattern => pattern.test(commit))) {
        hasMajor = true;
        majorCommits.push(commit);
      }
    });

    const bumpType = hasMajor ? VERSION_TYPES.MAJOR : VERSION_TYPES.MINOR;

    if (majorCommits.length > 0) {
      console.log(`\nBreaking changes detected: ${majorCommits.length} commits`);
    }
    console.log(`Version bump: ${bumpType.toUpperCase()}`);

    return bumpType;
  }

  /**
   * Bump version based on type (two-part: MAJOR.MINOR)
   */
  bumpVersion(currentVersion, bumpType) {
    const parts = currentVersion.split('.').map(Number);
    const major = parts[0] || 1;
    const minor = parts[1] || 0;

    switch (bumpType) {
      case VERSION_TYPES.MAJOR:
        return `${major + 1}.0`;
      case VERSION_TYPES.MINOR:
        return `${major}.${minor + 1}`;
      default:
        throw new Error(`Unknown bump type: ${bumpType}`);
    }
  }

  /**
   * Update package.json file with new version
   */
  updatePackageJson(filePath, newVersion) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      packageJson.version = newVersion;
      fs.writeFileSync(filePath, JSON.stringify(packageJson, null, 2) + '\n');
      console.log(`Updated ${path.relative(process.cwd(), filePath)} to v${newVersion}`);
    } catch (error) {
      console.error(`Error updating ${filePath}:`, error.message);
      throw error;
    }
  }

  /**
   * Create git tag for new version
   */
  createGitTag(version) {
    try {
      const tagName = `v${version}`;
      execSync(`git add package.json dashboard/package.json`);
      execSync(`git commit -m "chore: bump version to ${version}"`);
      execSync(`git tag -a ${tagName} -m "Release ${tagName}"`);
      console.log(`Created git tag: ${tagName}`);
    } catch (error) {
      console.error('Error creating git tag:', error.message);
      // Don't fail the process for git tag errors
    }
  }

  /**
   * Main versioning process
   */
  async run() {
    console.log('Starting automatic versioning...\n');

    // Get current version
    const currentVersion = this.getCurrentVersion();
    console.log(`Current version: v${currentVersion}`);

    // Get commits since last version
    const commits = this.getCommitsSinceLastVersion();

    // Analyze commits to determine bump type
    const bumpType = this.analyzeCommits(commits);

    // Calculate new version
    const newVersion = this.bumpVersion(currentVersion, bumpType);

    console.log(`\nv${currentVersion} -> v${newVersion} (${bumpType})`);

    // Update package.json files
    console.log('\nUpdating package.json files...');
    this.updatePackageJson(this.rootPackagePath, newVersion);
    this.updatePackageJson(this.dashboardPackagePath, newVersion);

    // Create git tag
    console.log('\nCreating git tag...');
    this.createGitTag(newVersion);

    console.log(`\nDone! New version: v${newVersion}`);

    // Return new version for use in build process
    return newVersion;
  }
}

// Run if called directly
if (require.main === module) {
  const versioner = new AutoVersioner();
  versioner.run().catch(error => {
    console.error('Automatic versioning failed:', error.message);
    process.exit(1);
  });
}

module.exports = AutoVersioner;
