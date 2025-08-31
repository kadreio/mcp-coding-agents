import { Request, Response } from 'express';

// Extended Express types with request ID
export interface ApiRequest extends Request {
  requestId: string;
}

export interface ApiResponse extends Response {
  requestId?: string;
}

// Error details interface
export interface ErrorDetails {
  limit?: number;
  window?: number;
  reset?: string;
  field?: string;
  value?: unknown;
  [key: string]: unknown;
}

// Notification types for SSE
export interface ClaudeNotification {
  method: string;
  params: {
    level: 'info' | 'warning' | 'error' | 'progress';
    data: string | NotificationData;
  };
}

export interface NotificationData {
  message?: string;
  type?: string;
  delta?: string;
  snapshot?: string;
  [key: string]: unknown;
}

// API Info Response
export interface ApiInfoResponse {
  name: string;
  version: string;
  transport: string;
  apis: {
    mcp: {
      endpoint: string;
      capabilities: {
        tools: string[];
        resources: string[];
        prompts: string[];
      };
    };
    claudeCode?: {
      endpoint: string;
      documentation: string;
      endpoints: string[];
    };
  };
}

// Type guards
export function isErrorWithMessage(error: unknown): error is Error {
  return error instanceof Error || (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

export function getErrorMessage(error: unknown): string {
  if (isErrorWithMessage(error)) {
    return error.message;
  }
  return 'Unknown error occurred';
}