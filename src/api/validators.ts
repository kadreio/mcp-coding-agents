import { CreateSessionRequest, SendMessageRequest } from './claude-code-api';

// Type guard for CreateSessionRequest
export function isCreateSessionRequest(body: unknown): body is CreateSessionRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  
  const obj = body as Record<string, unknown>;
  
  // All fields are optional, but if present must be correct type
  if ('model' in obj && typeof obj.model !== 'string') {
    return false;
  }
  
  if ('claudeCodeModel' in obj && typeof obj.claudeCodeModel !== 'string') {
    return false;
  }
  
  if ('cwd' in obj && typeof obj.cwd !== 'string') {
    return false;
  }
  
  if ('permissionMode' in obj) {
    const validModes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
    if (typeof obj.permissionMode !== 'string' || !validModes.includes(obj.permissionMode)) {
      return false;
    }
  }
  
  if ('maxTurns' in obj && (typeof obj.maxTurns !== 'number' || obj.maxTurns < 0)) {
    return false;
  }
  
  if ('maxMessages' in obj && (typeof obj.maxMessages !== 'number' || obj.maxMessages < 0)) {
    return false;
  }
  
  if ('includeSystemMessages' in obj && typeof obj.includeSystemMessages !== 'boolean') {
    return false;
  }
  
  return true;
}

// Type guard for SendMessageRequest
export function isSendMessageRequest(body: unknown): body is SendMessageRequest {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  
  const obj = body as Record<string, unknown>;
  
  // prompt is required
  if (!('prompt' in obj) || typeof obj.prompt !== 'string') {
    return false;
  }
  
  // timeout is optional but must be number if present
  if ('timeout' in obj && typeof obj.timeout !== 'number') {
    return false;
  }
  
  return true;
}

// Helper to get validation error message
export function getValidationError(body: unknown, type: 'CreateSessionRequest' | 'SendMessageRequest'): string {
  if (typeof body !== 'object' || body === null) {
    return 'Request body must be an object';
  }
  
  if (type === 'SendMessageRequest') {
    const obj = body as Record<string, unknown>;
    if (!('prompt' in obj)) {
      return 'Missing required field: prompt';
    }
    if (typeof obj.prompt !== 'string') {
      return 'Field "prompt" must be a string';
    }
  }
  
  if (type === 'CreateSessionRequest') {
    const obj = body as Record<string, unknown>;
    if ('permissionMode' in obj) {
      const validModes = ['default', 'acceptEdits', 'bypassPermissions', 'plan'];
      if (!validModes.includes(obj.permissionMode as string)) {
        return `Invalid permissionMode. Must be one of: ${validModes.join(', ')}`;
      }
    }
  }
  
  return 'Invalid request body format';
}