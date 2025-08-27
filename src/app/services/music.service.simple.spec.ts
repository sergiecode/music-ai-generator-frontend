import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MusicService, MusicGenerationRequest, MusicGenerationResponse, TrackStatus } from './music.service';

describe('MusicService - Fixed Tests', () => {
  let service: MusicService;
  let httpMock: HttpTestingController;
  const baseURL = 'http://127.0.0.1:8000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule]
    });
    service = TestBed.inject(MusicService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Basic Service Tests', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should check server health', () => {
      const mockResponse = { status: 'healthy', service: 'music-ai-generator-backend' };

      service.checkServerHealth().subscribe(response => {
        expect(response.status).toBe('healthy');
        expect(response.service).toBe('music-ai-generator-backend');
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });

    it('should generate music', () => {
      const mockRequest: MusicGenerationRequest = {
        prompt: 'test music',
        duration: 30
      };

      const mockResponse: MusicGenerationResponse = {
        success: true,
        message: 'Music generation started',
        track_id: 'test_track_123',
        prompt: 'test music',
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      };

      service.generateMusic(mockRequest).subscribe(response => {
        expect(response.success).toBe(true);
        expect(response.track_id).toBe('test_track_123');
        expect(response.status).toBe('processing');
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(mockRequest);
      req.flush(mockResponse);
    });

    it('should get track status', () => {
      const trackId = 'test_track_123';
      const mockStatus: TrackStatus = {
        track_id: trackId,
        status: 'completed',
        progress: 100,
        prompt: 'test music',
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://127.0.0.1:8000/downloads/test_track_123.mp3'
      };

      service.getTrackStatus(trackId).subscribe(status => {
        expect(status.status).toBe('completed');
        expect(status.progress).toBe(100);
        expect(status.track_id).toBe(trackId);
      });

      const req = httpMock.expectOne(`${baseURL}/music/status/${trackId}`);
      expect(req.request.method).toBe('GET');
      req.flush(mockStatus);
    });
  });

  describe('Error Handling', () => {
    it('should handle server connection errors', () => {
      service.checkServerHealth().subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Cannot connect to server');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/health`);
      req.flush(null, { status: 0, statusText: 'Network error' });
    });

    it('should handle generation errors', () => {
      const mockRequest: MusicGenerationRequest = {
        prompt: 'test music',
        duration: 30
      };

      service.generateMusic(mockRequest).subscribe({
        next: () => fail('Should have failed'),
        error: (error) => {
          expect(error.message).toContain('Server error');
        }
      });

      const req = httpMock.expectOne(`${baseURL}/music/generate`);
      req.flush({ error: 'Server error' }, { status: 500, statusText: 'Internal Server Error' });
    });
  });
});
