import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MusicService } from './services/music.service';

/**
 * E2E-like tests that test the real API endpoints
 * These tests require the backend server to be running
 * Run with: npm run test:e2e
 */
describe('E2E API Tests (Backend Required)', () => {
  let service: MusicService;
  let httpMock: HttpTestingController;
  
  // Set this to true to run against real backend
  const USE_REAL_BACKEND = false;
  const BACKEND_URL = 'http://127.0.0.1:8000';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [USE_REAL_BACKEND ? [] : [HttpClientTestingModule]],
      providers: [MusicService]
    });
    
    service = TestBed.inject(MusicService);
    if (!USE_REAL_BACKEND) {
      httpMock = TestBed.inject(HttpTestingController);
    }
  });

  afterEach(() => {
    if (!USE_REAL_BACKEND) {
      httpMock.verify();
    }
  });

  describe('Real Backend Integration', () => {
    // Skip these tests if backend is not available
    
    (USE_REAL_BACKEND ? it : xit)('should connect to real backend health endpoint', (done: DoneFn) => {
      service.checkServerHealth().subscribe({
        next: (response) => {
          expect(response.status).toBe('healthy');
          expect(response.service).toBe('music-ai-generator-backend');
          done();
        },
        error: (error) => {
          console.error('Backend not available:', error);
          pending('Backend server not running');
        }
      });
    });

    (USE_REAL_BACKEND ? it : xit)('should get service info from real backend', (done: DoneFn) => {
      service.getServiceInfo().subscribe({
        next: (response) => {
          expect(response.service).toBe('Music AI Generator');
          expect(response.version).toBeTruthy();
          expect(response.supported_formats).toContain('mp3');
          expect(response.max_duration).toBeGreaterThan(0);
          expect(response.min_duration).toBeGreaterThan(0);
          done();
        },
        error: (error) => {
          console.error('Backend not available:', error);
          pending('Backend server not running');
        }
      });
    });

    (USE_REAL_BACKEND ? it : xit)('should generate music with real backend', (done: DoneFn) => {
      const request = {
        prompt: 'short test melody',
        duration: 5 // Short duration for testing
      };

      service.generateMusic(request).subscribe({
        next: (response) => {
          expect(response.success).toBe(true);
          expect(response.track_id).toBeTruthy();
          expect(response.prompt).toBe(request.prompt);
          expect(response.duration).toBe(request.duration);
          expect(response.status).toBe('processing');
          
          // Don't wait for completion in this test
          done();
        },
        error: (error) => {
          console.error('Generation failed:', error);
          fail('Music generation should succeed with valid input');
        }
      });
    }, 10000); // Longer timeout for real backend

    (USE_REAL_BACKEND ? it : xit)('should handle invalid generation request', (done: DoneFn) => {
      const request = {
        prompt: '', // Invalid empty prompt
        duration: 30
      };

      service.generateMusic(request).subscribe({
        next: () => {
          fail('Should have failed with empty prompt');
        },
        error: (error) => {
          expect(error.message).toContain('Invalid input parameters');
          done();
        }
      });
    });
  });

  describe('Mock Backend Tests', () => {
    // These tests run with mocked backend responses

    (!USE_REAL_BACKEND ? it : xit)('should simulate complete workflow', (done: DoneFn) => {
      const mockTrackId = 'mock_track_123';
      
      // Step 1: Generate music
      service.generateMusic({
        prompt: 'test music',
        duration: 30
      }).subscribe({
        next: (response) => {
          expect(response.track_id).toBe(mockTrackId);
          
          // Step 2: Check status
          service.getTrackStatus(mockTrackId).subscribe({
            next: (status) => {
              expect(status.track_id).toBe(mockTrackId);
              expect(status.status).toBe('completed');
              done();
            }
          });

          // Mock status request
          const statusReq = httpMock.expectOne(`${BACKEND_URL}/music/status/${mockTrackId}`);
          statusReq.flush({
            track_id: mockTrackId,
            status: 'completed',
            progress: 100,
            prompt: 'test music',
            duration: 30,
            created_at: '2025-08-27T10:30:00Z',
            estimated_completion: '2025-08-27T10:31:00Z',
            download_url: `${BACKEND_URL}/downloads/${mockTrackId}.mp3`
          });
        }
      });

      // Mock generation request
      const generateReq = httpMock.expectOne(`${BACKEND_URL}/music/generate`);
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: mockTrackId,
        prompt: 'test music',
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
    });

    (!USE_REAL_BACKEND ? it : xit)('should simulate polling workflow', (done: DoneFn) => {
      const mockTrackId = 'poll_track_123';
      let pollCount = 0;
      
      service.pollTrackStatus(mockTrackId).subscribe({
        next: (status) => {
          if (status.status === 'completed') {
            expect(status.progress).toBe(100);
            expect(pollCount).toBeGreaterThan(0);
            done();
          }
          pollCount++;
        }
      });

      // Mock multiple status responses
      setTimeout(() => {
        const req1 = httpMock.expectOne(`${BACKEND_URL}/music/status/${mockTrackId}`);
        req1.flush({
          track_id: mockTrackId,
          status: 'processing',
          progress: 50,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: null
        });
      }, 0);

      setTimeout(() => {
        const req2 = httpMock.expectOne(`${BACKEND_URL}/music/status/${mockTrackId}`);
        req2.flush({
          track_id: mockTrackId,
          status: 'completed',
          progress: 100,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: `${BACKEND_URL}/downloads/${mockTrackId}.mp3`
        });
      }, 2000);
    }, 5000);
  });
});

/**
 * Performance and Load Tests
 */
describe('Performance Tests', () => {
  let service: MusicService;
  let httpMock: HttpTestingController;

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

  it('should handle multiple concurrent requests', (done) => {
    const requests = 5;
    let completed = 0;
    
    for (let i = 0; i < requests; i++) {
      service.generateMusic({
        prompt: `test prompt ${i}`,
        duration: 30
      }).subscribe({
        next: () => {
          completed++;
          if (completed === requests) {
            done();
          }
        }
      });
    }

    // Mock all requests
    for (let i = 0; i < requests; i++) {
      const req = httpMock.expectOne(`http://127.0.0.1:8000/music/generate`);
      req.flush({
        success: true,
        message: 'Generation started',
        track_id: `track_${i}`,
        prompt: `test prompt ${i}`,
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
    }
  });

  it('should handle rapid polling requests', (done) => {
    const trackId = 'rapid_poll_track';
    let pollCount = 0;
    const maxPolls = 3;
    
    service.pollTrackStatus(trackId).subscribe({
      next: (status) => {
        pollCount++;
        if (status.status === 'completed' && pollCount >= maxPolls) {
          done();
        }
      }
    });

    // Mock rapid responses
    for (let i = 0; i < maxPolls; i++) {
      setTimeout(() => {
        const req = httpMock.expectOne(`http://127.0.0.1:8000/music/status/${trackId}`);
        req.flush({
          track_id: trackId,
          status: i === maxPolls - 1 ? 'completed' : 'processing',
          progress: ((i + 1) / maxPolls) * 100,
          prompt: 'test',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: i === maxPolls - 1 ? `http://127.0.0.1:8000/downloads/${trackId}.mp3` : null
        });
      }, i * 2000);
    }
  }, 10000);

  it('should handle large prompt sanitization efficiently', () => {
    const largePrompt = 'a'.repeat(1000);
    const scriptInjection = '<script>alert("test")</script>';
    const combinedPrompt = largePrompt + scriptInjection + largePrompt;
    
    const startTime = performance.now();
    
    service.generateMusic({
      prompt: combinedPrompt,
      duration: 30
    }).subscribe();
    
    const req = httpMock.expectOne(`http://127.0.0.1:8000/music/generate`);
    const endTime = performance.now();
    
    // Should complete quickly (under 100ms)
    expect(endTime - startTime).toBeLessThan(100);
    
    // Should be sanitized and truncated
    expect(req.request.body.prompt.length).toBeLessThanOrEqual(500);
    expect(req.request.body.prompt).not.toContain('<script>');
    
    req.flush({
      success: true,
      message: 'Generation started',
      track_id: 'large_prompt_track',
      prompt: req.request.body.prompt,
      duration: 30,
      estimated_processing_time: 15,
      status: 'processing',
      download_url: null
    });
  });
});
