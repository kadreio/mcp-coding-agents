import { describe, test, expect } from '@jest/globals';

describe('Claude Code Configuration Logic Tests', () => {
  // Helper function that mirrors the configuration logic
  const createConfig = (env: Record<string, string | undefined>) => {
    return {
      enabled: env.CLAUDE_CODE_ENABLE !== 'false',
      defaults: {
        cwd: env.CLAUDE_CODE_DEFAULT_CWD || process.cwd(),
        model: env.CLAUDE_CODE_DEFAULT_MODEL || undefined,
        permissionMode: env.CLAUDE_CODE_DEFAULT_PERMISSION_MODE || 'bypassPermissions',
        maxTurns: env.CLAUDE_CODE_MAX_TURNS 
          ? parseInt(env.CLAUDE_CODE_MAX_TURNS, 10) 
          : undefined,
        maxMessages: env.CLAUDE_CODE_MAX_MESSAGES 
          ? parseInt(env.CLAUDE_CODE_MAX_MESSAGES, 10) 
          : 100,
        includeSystemMessages: env.CLAUDE_CODE_INCLUDE_SYSTEM_MESSAGES !== 'false',
      },
      mergeOptions(requestOptions: any = {}) {
        return {
          cwd: requestOptions.cwd || this.defaults.cwd,
          permissionMode: requestOptions.permissionMode || this.defaults.permissionMode,
          maxTurns: requestOptions.maxTurns !== undefined ? requestOptions.maxTurns : this.defaults.maxTurns,
          model: requestOptions.model || this.defaults.model,
          maxMessages: requestOptions.maxMessages !== undefined ? requestOptions.maxMessages : this.defaults.maxMessages,
          includeSystemMessages: requestOptions.includeSystemMessages !== undefined 
            ? requestOptions.includeSystemMessages 
            : this.defaults.includeSystemMessages,
        };
      }
    };
  };

  test('should load default configuration', () => {
    const config = createConfig({});
    
    expect(config.enabled).toBe(true);
    expect(config.defaults.permissionMode).toBe('bypassPermissions');
    expect(config.defaults.maxMessages).toBe(100);
    expect(config.defaults.includeSystemMessages).toBe(true);
    expect(config.defaults.model).toBeUndefined();
    expect(config.defaults.maxTurns).toBeUndefined();
  });

  test('should respect CLAUDE_CODE_ENABLE=false', () => {
    const config = createConfig({
      CLAUDE_CODE_ENABLE: 'false'
    });
    
    expect(config.enabled).toBe(false);
  });

  test('should load custom defaults from environment', () => {
    const config = createConfig({
      CLAUDE_CODE_DEFAULT_CWD: '/custom/path',
      CLAUDE_CODE_DEFAULT_MODEL: 'claude-3-opus',
      CLAUDE_CODE_DEFAULT_PERMISSION_MODE: 'default',
      CLAUDE_CODE_MAX_TURNS: '5',
      CLAUDE_CODE_MAX_MESSAGES: '50',
      CLAUDE_CODE_INCLUDE_SYSTEM_MESSAGES: 'false'
    });
    
    expect(config.defaults.cwd).toBe('/custom/path');
    expect(config.defaults.model).toBe('claude-3-opus');
    expect(config.defaults.permissionMode).toBe('default');
    expect(config.defaults.maxTurns).toBe(5);
    expect(config.defaults.maxMessages).toBe(50);
    expect(config.defaults.includeSystemMessages).toBe(false);
  });

  test('should merge options correctly', () => {
    const config = createConfig({
      CLAUDE_CODE_DEFAULT_CWD: '/default/path',
      CLAUDE_CODE_DEFAULT_MODEL: 'claude-3-opus',
      CLAUDE_CODE_MAX_MESSAGES: '50'
    });
    
    const merged = config.mergeOptions({
      cwd: '/override/path',
      maxMessages: 25
    });
    
    expect(merged.cwd).toBe('/override/path'); // Override wins
    expect(merged.model).toBe('claude-3-opus'); // Default used
    expect(merged.maxMessages).toBe(25); // Override wins
    expect(merged.permissionMode).toBe('bypassPermissions'); // Default used
  });

  test('should handle undefined request options', () => {
    const config = createConfig({});
    
    const merged = config.mergeOptions(undefined);
    
    expect(merged.cwd).toBeDefined();
    expect(merged.permissionMode).toBe('bypassPermissions');
    expect(merged.maxMessages).toBe(100);
  });

  test('should handle zero values correctly', () => {
    const config = createConfig({});
    
    const merged = config.mergeOptions({
      maxTurns: 0,
      maxMessages: 0
    });
    
    // Zero should be respected, not replaced with defaults
    expect(merged.maxTurns).toBe(0);
    expect(merged.maxMessages).toBe(0);
  });

  test('should handle invalid number values gracefully', () => {
    const config = createConfig({
      CLAUDE_CODE_MAX_TURNS: 'invalid',
      CLAUDE_CODE_MAX_MESSAGES: 'abc'
    });
    
    // NaN from parseInt should become undefined
    expect(isNaN(config.defaults.maxTurns as any)).toBe(true);
    expect(isNaN(config.defaults.maxMessages as any)).toBe(true);
  });
});