import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';

/**
 * Test utilities and helpers for the Music AI Generator app
 * Note: This file provides utility functions for tests.
 * The expect() and jasmine functions are available in test files that import this.
 */

// Mock component for routing tests
@Component({
  template: '<div>Mock Component</div>'
})
export class MockComponent { }

/**
 * Common test configuration for components
 */
export const createTestingModule = (additionalImports: any[] = [], additionalProviders: any[] = []) => {
  return TestBed.configureTestingModule({
    imports: [
      CommonModule,
      ReactiveFormsModule,
      HttpClientTestingModule,
      RouterTestingModule.withRoutes([
        { path: '', component: MockComponent },
        { path: '**', component: MockComponent }
      ]),
      ...additionalImports
    ],
    providers: [...additionalProviders],
    declarations: [MockComponent]
  });
};

/**
 * Mock data for tests
 */
export const mockData = {
  healthResponse: {
    status: 'healthy',
    service: 'music-ai-generator-backend'
  },
  
  serviceInfo: {
    service: 'Music AI Generator',
    version: '1.0.0',
    supported_formats: ['mp3', 'wav'],
    max_duration: 300,
    min_duration: 5,
    status: 'active'
  },
  
  generationRequest: {
    prompt: 'relaxing piano melody for meditation',
    duration: 60
  },
  
  generationResponse: {
    success: true,
    message: 'Music generation started',
    track_id: 'track_test_123',
    prompt: 'relaxing piano melody for meditation',
    duration: 60,
    estimated_processing_time: 45,
    status: 'processing',
    download_url: null
  },
  
  processingStatus: {
    track_id: 'track_test_123',
    status: 'processing' as const,
    progress: 50,
    prompt: 'relaxing piano melody for meditation',
    duration: 60,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: null
  },
  
  completedStatus: {
    track_id: 'track_test_123',
    status: 'completed' as const,
    progress: 100,
    prompt: 'relaxing piano melody for meditation',
    duration: 60,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: 'http://127.0.0.1:8000/downloads/track_test_123.mp3'
  },
  
  failedStatus: {
    track_id: 'track_test_123',
    status: 'failed' as const,
    progress: 0,
    prompt: 'relaxing piano melody for meditation',
    duration: 60,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: null
  },
  
  validationError: {
    detail: [
      {
        loc: ['body', 'prompt'],
        msg: 'ensure this value has at least 1 characters',
        type: 'value_error.any_str.min_length'
      }
    ]
  }
};

/**
 * Utility function to wait for async operations in tests
 */
export const waitForAsync = (ms: number = 0): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Utility to trigger change detection and wait
 */
export const detectChangesAndWait = async (fixture: any, ms: number = 0): Promise<void> => {
  fixture.detectChanges();
  await waitForAsync(ms);
};

/**
 * Utility to simulate user input
 */
export const setFormValue = (fixture: any, selector: string, value: any): void => {
  const element = fixture.nativeElement.querySelector(selector);
  if (element) {
    element.value = value;
    element.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }
};

/**
 * Utility to click elements
 */
export const clickElement = (fixture: any, selector: string): void => {
  const element = fixture.nativeElement.querySelector(selector);
  if (element) {
    element.click();
    fixture.detectChanges();
  }
};

/**
 * Test data generators
 */
export const generateTestTrackId = (): string => {
  return `track_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateTestPrompt = (length: number = 50): string => {
  const words = ['relaxing', 'upbeat', 'classical', 'electronic', 'jazz', 'piano', 'guitar', 'drums', 'melody', 'harmony'];
  let prompt = '';
  while (prompt.length < length) {
    prompt += words[Math.floor(Math.random() * words.length)] + ' ';
  }
  return prompt.trim().substring(0, length);
};

/**
 * Environment simulation helpers
 */
export const simulateNetworkError = () => {
  return new Error('Cannot connect to server. Please ensure the backend is running on http://127.0.0.1:8000');
};

export const simulateServerError = (status: number, message: string) => {
  const error = new Error(message);
  (error as any).status = status;
  return error;
};

/**
 * Performance testing utilities
 */
export const measureExecutionTime = async (fn: () => Promise<any>): Promise<{ result: any; time: number }> => {
  const start = performance.now();
  const result = await fn();
  const end = performance.now();
  return { result, time: end - start };
};

/**
 * DOM testing utilities
 */
export const getElement = (fixture: any, selector: string): HTMLElement | null => {
  return fixture.nativeElement.querySelector(selector);
};

export const getAllElements = (fixture: any, selector: string): NodeListOf<HTMLElement> => {
  return fixture.nativeElement.querySelectorAll(selector);
};

export const hasElement = (fixture: any, selector: string): boolean => {
  return !!fixture.nativeElement.querySelector(selector);
};

export const getElementText = (fixture: any, selector: string): string => {
  const element = fixture.nativeElement.querySelector(selector);
  return element?.textContent?.trim() || '';
};

export const hasElementWithText = (fixture: any, selector: string, text: string): boolean => {
  const element = fixture.nativeElement.querySelector(selector);
  return element?.textContent?.includes(text) || false;
};

export const hasElementWithClass = (fixture: any, selector: string, className: string): boolean => {
  const element = fixture.nativeElement.querySelector(selector);
  return element?.classList.contains(className) || false;
};

/**
 * Form testing utilities
 */
export const isFormValid = (form: any): boolean => {
  return form.valid;
};

export const isFormInvalid = (form: any): boolean => {
  return form.invalid;
};

export const hasFieldError = (form: any, fieldName: string, errorType: string): boolean => {
  const field = form.get(fieldName);
  return !!field?.errors?.[errorType];
};

/**
 * HTTP testing utilities
 */
export const getHttpRequest = (httpMock: any, url: string) => {
  return httpMock.expectOne(url);
};

export const verifyHttpRequest = (req: any, method: string): boolean => {
  return req.request.method === method;
};

/**
 * Accessibility testing helpers
 */
export const getAriaLabel = (fixture: any, selector: string): string | null => {
  const element = fixture.nativeElement.querySelector(selector);
  return element?.getAttribute('aria-label');
};

export const isElementAccessible = (fixture: any, selector: string): boolean => {
  const element = fixture.nativeElement.querySelector(selector);
  return element?.tabIndex >= 0;
};
