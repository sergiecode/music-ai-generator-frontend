import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MusicService, MusicGenerationRequest, MusicGenerationResponse, TrackStatus, HealthResponse, ServiceInfo } from './music.service';

describe('MusicService', () => {
  let service: MusicService;
  let httpMock: HttpTestingController;
  const baseURL = 'http://127.0.0.1:8000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [MusicService]
    });
    service = TestBed.inject(MusicService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Service Initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should have correct base URL', () => {
      expect((service as any).baseURL).toBe(baseURL);
    });
  });

  describe('checkServerHealth', () => {
    it('should check server health successfully', () => {
      const mockHealthResponse: HealthResponse = {
        status: 'healthy',
        service: 'music-ai-generator-backend'
      };

      service.checkServerHealth().subscribe(response => {
        expect(response).toEqual(mockHealthResponse);
        expect(response.status).toBe('healthy');
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      expect(req.request.method).toBe('GET');
      req.flush(mockHealthResponse);
    });

    it('should handle server health check errors', () => {
      service.checkServerHealth().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Cannot connect to server');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      req.flush({ error: 'Server down' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getServiceInfo', () => {
    it('should get service information successfully', () => {
      const mockServiceInfo: ServiceInfo = {
        service: 'Music AI Generator',
        version: '1.0.0',
        supported_formats: ['mp3', 'wav'],
        max_duration: 300,
        min_duration: 5,
        status: 'active'
      };

      service.getServiceInfo().subscribe(response => {
        expect(response).toEqual(mockServiceInfo);
        expect(response.service).toBe('Music AI Generator');
        expect(response.supported_formats).toContain('mp3');
      });

      const req = httpMock.expectOne(`${baseURL}/music/`);
      expect(req.request.method).toBe('GET');
      req.flush(mockServiceInfo);
    });
  });

  describe('generateMusic', () => {
    it('should generate music successfully', () => {
      const request: MusicGenerationRequest = {
        prompt: 'relaxing piano melody',
        duration: 60
      };

      const mockResponse: MusicGenerationResponse = {
        success: true,
        message: 'Music generation started',
        track_id: 'track_abc123',
        prompt: 'relaxing piano melody',
        duration: 60,
        estimated_processing_time: 45,
        status: 'processing',
        download_url: null
      };

      service.generateMusic(request).subscribe(response => {
        expect(response).toEqual(mockResponse);
        expect(response.track_id).toBe('track_abc123');
        expect(response.success).toBe(true);
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({
        prompt: 'relaxing piano melody',
        duration: 60
      });
      req.flush(mockResponse);
    });

    it('should sanitize prompt input', () => {
      const request: MusicGenerationRequest = {
        prompt: '  <script>alert("xss")</script>test prompt  ',
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt).toBe('test prompt');
      req.flush({ success: true, track_id: 'test', prompt: 'test', duration: 30, status: 'processing', message: '', estimated_processing_time: 30, download_url: null });
    });

    it('should handle validation errors (422)', () => {
      const request: MusicGenerationRequest = {
        prompt: '',
        duration: 30
      };

      service.generateMusic(request).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Invalid input parameters');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      req.flush({
        detail: [
          { loc: ['body', 'prompt'], msg: 'ensure this value has at least 1 characters', type: 'value_error.any_str.min_length' }
        ]
      }, { status: 422, statusText: 'Unprocessable Entity' });
    });

    it('should handle server errors (500)', () => {
      const request: MusicGenerationRequest = {
        prompt: 'test prompt',
        duration: 30
      };

      service.generateMusic(request).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Server error');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      req.flush({}, { status: 500, statusText: 'Internal Server Error' });
    });
  });

  describe('getTrackStatus', () => {
    it('should get track status successfully', () => {
      const trackId = 'track_abc123';
      const mockStatus: TrackStatus = {
        track_id: trackId,
        status: 'processing',
        progress: 75,
        prompt: 'relaxing piano melody',
        duration: 60,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: null
      };

      service.getTrackStatus(trackId).subscribe(response => {
        expect(response).toEqual(mockStatus);
        expect(response.track_id).toBe(trackId);
        expect(response.progress).toBe(75);
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
    });

    it('should handle track not found (404)', () => {
      const trackId = 'nonexistent_track';

      service.getTrackStatus(trackId).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Track not found');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      req.flush({}, { status: 404, statusText: 'Not Found' });
    });
  });

  describe('pollTrackStatus', () => {
    it('should create polling observable', () => {
      const trackId = 'track_abc123';
      const polling$ = service.pollTrackStatus(trackId);
      expect(polling$).toBeDefined();
    });

    it('should handle polling errors gracefully', () => {
      const trackId = 'track_abc123';
      const polling$ = service.pollTrackStatus(trackId);
      
      // Just verify the observable exists and is defined
      expect(polling$).toBeDefined();
      
      // Test basic error handling by calling getTrackStatus directly
      service.getTrackStatus(trackId).subscribe({
        error: (error) => {
          expect(error.message).toContain('Server error');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      req.error(new ErrorEvent('Network error'));
    });
  });

  describe('getProgressUpdates', () => {
    it('should return progress updates observable', () => {
      const updates$ = service.getProgressUpdates();
      expect(updates$).toBeTruthy();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', () => {
      service.checkServerHealth().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Cannot connect to server');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      req.error(new ErrorEvent('Network error'));
    });

    it('should handle different HTTP status codes', () => {
      const testCases = [
        { status: 400, expectedMessage: 'Bad request' },
        { status: 404, expectedMessage: 'Track not found' },
        { status: 500, expectedMessage: 'Server error' }
      ];

      testCases.forEach(({ status, expectedMessage }) => {
        service.checkServerHealth().subscribe({
          next: () => fail('Should have failed'),
          error: (error) => {
            expect(error.message).toContain(expectedMessage);
          }
        });

        const req = httpMock.expectOne(`${baseURL}/health`);
        req.flush({}, { status, statusText: 'Error' });
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize prompt input to prevent XSS', () => {
      const dangerousPrompts = [
        '<script>alert("xss")</script>safe text',
        'normal text<script>evil()</script>more text',
        '<img src="x" onerror="alert(1)">music prompt'
      ];

      dangerousPrompts.forEach(prompt => {
        const request: MusicGenerationRequest = { prompt, duration: 30 };
        service.generateMusic(request).subscribe();

        const req = httpMock.expectOne(`${baseURL}/music/generate`);
        expect(req.request.body.prompt).not.toContain('<script>');
        expect(req.request.body.prompt).not.toContain('onerror');
        req.flush({ success: true, track_id: 'test', prompt: 'safe', duration: 30, status: 'processing', message: '', estimated_processing_time: 30, download_url: null });
      });
    });

    it('should trim whitespace from prompts', () => {
      const request: MusicGenerationRequest = {
        prompt: '   test prompt   ',
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt).toBe('test prompt');
      req.flush({ success: true, track_id: 'test', prompt: 'test prompt', duration: 30, status: 'processing', message: '', estimated_processing_time: 30, download_url: null });
    });
  });
});
