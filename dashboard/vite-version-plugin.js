import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Vite plugin to inject version information at build time
 */
export function viteVersionPlugin() {
  return {
    name: 'version-injection',
    config(config, { command }) {
      // Read version from package.json
      const packageJsonPath = resolve(process.cwd(), '../package.json');
      let version = '1.0.0';
      
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        version = packageJson.version;
      } catch (error) {
        console.warn('Could not read version from package.json, using default:', version);
      }

      // Get build timestamp
      const buildTimestamp = new Date().toISOString();

      // Try to get git commit hash
      let gitCommit = 'unknown';
      try {
        const { execSync } = require('child_process');
        gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch (error) {
        // Git not available or not in a git repo
      }

      // Inject environment variables
      config.define = {
        ...config.define,
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(version),
        'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(buildTimestamp),
        'import.meta.env.VITE_GIT_COMMIT': JSON.stringify(gitCommit),
      };

      console.log(`🏷️  Injecting version: v${version} (${gitCommit}) built at ${buildTimestamp}`);
    }
  };
}
