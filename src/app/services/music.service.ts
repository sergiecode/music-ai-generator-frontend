import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, interval, throwError } from 'rxjs';
import { switchMap, takeWhile, catchError, startWith } from 'rxjs/operators';

export interface MusicGenerationRequest {
  prompt: string;
  duration?: number;
}

export interface MusicGenerationResponse {
  success: boolean;
  message: string;
  track_id: string;
  prompt: string;
  duration: number;
  estimated_processing_time: number;
  status: string;
  download_url: string | null;
}

export interface TrackStatus {
  track_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  prompt: string;
  duration: number;
  created_at: string;
  estimated_completion: string;
  download_url: string | null;
}

export interface HealthResponse {
  status: string;
  service: string;
}

export interface ServiceInfo {
  service: string;
  version: string;
  supported_formats: string[];
  max_duration: number;
  min_duration: number;
  status: string;
}

@Injectable({
  providedIn: 'root'
})
export class MusicService {
  private readonly baseURL = 'http://127.0.0.1:8000';
  private progressSubject = new Subject<TrackStatus>();

  constructor(private http: HttpClient) {}

  /**
   * Check if the backend server is healthy and responding
   */
  checkServerHealth(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseURL}/health`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get service information from the backend
   */
  getServiceInfo(): Observable<ServiceInfo> {
    return this.http.get<ServiceInfo>(`${this.baseURL}/music/`).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Generate music based on the provided prompt and duration
   */
  generateMusic(request: MusicGenerationRequest): Observable<MusicGenerationResponse> {
    // Validate and sanitize the request
    const sanitizedRequest = {
      prompt: this.sanitizePrompt(request.prompt),
      duration: request.duration || 30
    };

    return this.http.post<MusicGenerationResponse>(
      `${this.baseURL}/music/generate`,
      sanitizedRequest
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Get the current status of a track generation
   */
  getTrackStatus(trackId: string): Observable<TrackStatus> {
    return this.http.get<TrackStatus>(
      `${this.baseURL}/music/status/${trackId}`
    ).pipe(
      catchError(this.handleError)
    );
  }

  /**
   * Poll track status every 2 seconds until completion or failure
   */
  pollTrackStatus(trackId: string): Observable<TrackStatus> {
    return interval(2000).pipe(
      switchMap(() => this.getTrackStatus(trackId)),
      takeWhile(status => status.status === 'processing', true),
      catchError(this.handleError)
    );
  }

  /**
   * Get observable for progress updates
   */
  getProgressUpdates(): Observable<TrackStatus> {
    return this.progressSubject.asObservable();
  }

  /**
   * Sanitize the prompt input to prevent security issues
   */
  private sanitizePrompt(prompt: string): string {
    return prompt
      .trim()
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '') // Remove event handlers like onerror, onclick, etc.
      .replace(/<[^>]*>/g, '') // Remove all HTML tags
      .substring(0, 500); // Max length validation
  }

  /**
   * Handle HTTP errors and provide user-friendly error messages
   */
  private handleError = (error: HttpErrorResponse) => {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Network Error: ${error.error.message}`;
    } else {
      // Server-side error
      switch (error.status) {
        case 0:
          errorMessage = 'Cannot connect to server. Please ensure the backend is running on http://127.0.0.1:8000';
          break;
        case 400:
          errorMessage = error.error?.detail || 'Bad request - please check your input';
          break;
        case 404:
          errorMessage = 'Track not found - it may have expired';
          break;
        case 422:
          errorMessage = 'Invalid input parameters - please check your prompt and duration';
          if (error.error?.detail && Array.isArray(error.error.detail)) {
            const validationErrors = error.error.detail
              .map((err: any) => err.msg)
              .join(', ');
            errorMessage += `: ${validationErrors}`;
          }
          break;
        case 500:
          errorMessage = 'Server error - please try again later';
          break;
        default:
          errorMessage = `Server error (${error.status}): ${error.error?.detail || error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  };
}
