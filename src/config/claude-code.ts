import dotenv from 'dotenv';

// Check if we're in STDIO mode
const isStdio = process.argv.includes('stdio') || 
                process.argv.includes('--transport') && process.argv[process.argv.indexOf('--transport') + 1] === 'stdio';

// Load environment variables
dotenv.config({ quiet: isStdio });

/**
 * Claude Code configuration from environment variables
 */
export const claudeCodeConfig = {
  // Feature flag to enable/disable Claude Code tool
  enabled: process.env.CLAUDE_CODE_ENABLE !== 'false', // Default: true
  
  // Default options for Claude Code queries
  defaults: {
    cwd: process.env.CLAUDE_CODE_DEFAULT_CWD || process.cwd(),
    model: process.env.CLAUDE_CODE_DEFAULT_MODEL || undefined,
    permissionMode: process.env.CLAUDE_CODE_DEFAULT_PERMISSION_MODE || 'bypassPermissions',
    maxTurns: process.env.CLAUDE_CODE_MAX_TURNS 
      ? parseInt(process.env.CLAUDE_CODE_MAX_TURNS, 10) 
      : undefined,
    maxMessages: process.env.CLAUDE_CODE_MAX_MESSAGES 
      ? parseInt(process.env.CLAUDE_CODE_MAX_MESSAGES, 10) 
      : 100,
    includeSystemMessages: process.env.CLAUDE_CODE_INCLUDE_SYSTEM_MESSAGES !== 'false', // Default: true
  },
  
  // Helper to merge request options with defaults
  mergeOptions(requestOptions: any = {}) {
    return {
      cwd: requestOptions.cwd || this.defaults.cwd,
      permissionMode: requestOptions.permissionMode || this.defaults.permissionMode,
      maxTurns: requestOptions.maxTurns !== undefined ? requestOptions.maxTurns : this.defaults.maxTurns,
      // Only set model if explicitly provided, otherwise let SDK use its default
      model: requestOptions.model !== undefined ? requestOptions.model : this.defaults.model,
      maxMessages: requestOptions.maxMessages !== undefined ? requestOptions.maxMessages : this.defaults.maxMessages,
      includeSystemMessages: requestOptions.includeSystemMessages !== undefined 
        ? requestOptions.includeSystemMessages 
        : this.defaults.includeSystemMessages,
    };
  }
};

// Log configuration on startup (only in non-STDIO mode)
if (!isStdio) {
  console.log('[claude-code-config] Configuration loaded:', {
    enabled: claudeCodeConfig.enabled,
    defaults: {
      ...claudeCodeConfig.defaults,
      cwd: claudeCodeConfig.defaults.cwd === process.cwd() ? '<current-directory>' : claudeCodeConfig.defaults.cwd,
    }
  });
}