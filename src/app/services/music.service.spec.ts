import { TestBed } from '@angular/core/testing';
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
  });

  describe('checkServerHealth', () => {
    it('should return server health status', () => {
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
      req.flush(null, { status: 0, statusText: 'Network error' });
    });
  });

  describe('getServiceInfo', () => {
    it('should return service information', () => {
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
        expect(response.success).toBe(true);
        expect(response.track_id).toBe('track_abc123');
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body.prompt).toBe('relaxing piano melody');
      expect(req.request.body.duration).toBe(60);
      req.flush(mockResponse);
    });

    it('should sanitize prompt input', () => {
      const request: MusicGenerationRequest = {
        prompt: '  <script>alert("hack")</script>test prompt  ',
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt).toBe('test prompt');
      req.flush({} as MusicGenerationResponse);
    });

    it('should use default duration if not provided', () => {
      const request: MusicGenerationRequest = {
        prompt: 'test music'
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.duration).toBe(30);
      req.flush({} as MusicGenerationResponse);
    });

    it('should handle validation errors (422)', () => {
      const request: MusicGenerationRequest = {
        prompt: '',
        duration: 30
      };

      const mockError = {
        detail: [
          {
            loc: ['body', 'prompt'],
            msg: 'ensure this value has at least 1 characters',
            type: 'value_error.any_str.min_length'
          }
        ]
      };

      service.generateMusic(request).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Invalid input parameters');
          expect(error.message).toContain('ensure this value has at least 1 characters');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      req.flush(mockError, { 
        status: 422, 
        statusText: 'Validation error'
      });
    });

    it('should handle bad request errors (400)', () => {
      const request: MusicGenerationRequest = {
        prompt: 'test',
        duration: 30
      };

      const mockError = { detail: 'Prompt cannot be empty' };

      service.generateMusic(request).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toBe('Prompt cannot be empty');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      req.flush(mockError, { 
        status: 400, 
        statusText: 'Bad request'
      });
    });
  });

  describe('getTrackStatus', () => {
    it('should return track status', () => {
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

      service.getTrackStatus(trackId).subscribe(status => {
        expect(status).toEqual(mockStatus);
        expect(status.progress).toBe(75);
        expect(status.status).toBe('processing');
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
    });

    it('should handle track not found (404)', () => {
      const trackId = 'invalid_track';

      service.getTrackStatus(trackId).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toBe('Track not found - it may have expired');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      req.flush(null, { status: 404, statusText: 'Not found' });
    });

    it('should return completed track with download URL', () => {
      const trackId = 'track_completed';
      const mockStatus: TrackStatus = {
        track_id: trackId,
        status: 'completed',
        progress: 100,
        prompt: 'relaxing piano melody',
        duration: 60,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://127.0.0.1:8000/downloads/track_completed.mp3'
      };

      service.getTrackStatus(trackId).subscribe(status => {
        expect(status.status).toBe('completed');
        expect(status.progress).toBe(100);
        expect(status.download_url).toContain('.mp3');
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      req.flush(mockStatus);
    });
  });

  describe('pollTrackStatus', () => {
    it('should poll until completion', (done) => {
      const trackId = 'track_polling';
      
      // Mock sequence: processing -> processing -> completed
      const mockStatuses: TrackStatus[] = [
        {
          track_id: trackId,
          status: 'processing',
          progress: 50,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: null
        },
        {
          track_id: trackId,
          status: 'processing',
          progress: 75,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: null
        },
        {
          track_id: trackId,
          status: 'completed',
          progress: 100,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: 'http://127.0.0.1:8000/downloads/track_polling.mp3'
        }
      ];

      let callCount = 0;
      const statuses: TrackStatus[] = [];

      service.pollTrackStatus(trackId).subscribe({
        next: (status) => {
          statuses.push(status);
          if (status.status === 'completed') {
            expect(statuses.length).toBe(3);
            expect(statuses[0].progress).toBe(50);
            expect(statuses[1].progress).toBe(75);
            expect(statuses[2].progress).toBe(100);
            expect(statuses[2].download_url).toContain('.mp3');
            done();
          }
        },
        error: (error) => done.fail(error)
      });

      // Handle multiple HTTP requests for polling
      const handleRequest = () => {
        const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
        req.flush(mockStatuses[callCount]);
        callCount++;
      };

      // Initial request and subsequent polling requests
      setTimeout(handleRequest, 0);
      setTimeout(handleRequest, 2000);
      setTimeout(handleRequest, 4000);
    });

    it('should stop polling on failure', (done) => {
      const trackId = 'track_failed';
      const mockStatus: TrackStatus = {
        track_id: trackId,
        status: 'failed',
        progress: 0,
        prompt: 'test',
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: null
      };

      service.pollTrackStatus(trackId).subscribe({
        next: (status) => {
          expect(status.status).toBe('failed');
          done();
        },
        error: (error) => done.fail(error)
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      req.flush(mockStatus);
    });
  });

  describe('Progress Updates', () => {
    it('should provide progress updates observable', () => {
      const progressUpdates = service.getProgressUpdates();
      expect(progressUpdates).toBeTruthy();
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
      req.flush(null, { status: 0, statusText: 'Network error' });
    });

    it('should handle server errors (500)', () => {
      service.checkServerHealth().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Server error - please try again later');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      req.flush(null, { status: 500, statusText: 'Server error' });
    });

    it('should handle unknown errors', () => {
      service.checkServerHealth().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Server error (999)');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      req.flush(null, { status: 999, statusText: 'Unknown error' });
    });
  });

  describe('Input Sanitization', () => {
    it('should sanitize script tags', () => {
      const request: MusicGenerationRequest = {
        prompt: '<script>alert("test")</script>clean prompt',
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt).toBe('clean prompt');
      req.flush({} as MusicGenerationResponse);
    });

    it('should trim whitespace', () => {
      const request: MusicGenerationRequest = {
        prompt: '   trimmed prompt   ',
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt).toBe('trimmed prompt');
      req.flush({} as MusicGenerationResponse);
    });

    it('should limit prompt length to 500 characters', () => {
      const longPrompt = 'a'.repeat(600);
      const request: MusicGenerationRequest = {
        prompt: longPrompt,
        duration: 30
      };

      service.generateMusic(request).subscribe();

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.body.prompt.length).toBe(500);
      req.flush({} as MusicGenerationResponse);
    });
  });
});
