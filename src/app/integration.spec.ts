import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ComponentFixture } from '@angular/core/testing';
import { fakeAsync, tick } from '@angular/core/testing';

import { GeneratorComponent } from './pages/generator/generator.component';
import { MusicService } from './services/music.service';

describe('Music Generator Integration Tests', () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let httpMock: HttpTestingController;
  let musicService: MusicService;
  const baseURL = 'http://127.0.0.1:8000';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        GeneratorComponent,
        HttpClientTestingModule,
        ReactiveFormsModule,
        CommonModule
      ],
      providers: [MusicService]
    }).compileComponents();

    fixture = TestBed.createComponent(GeneratorComponent);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
    musicService = TestBed.inject(MusicService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  describe('Complete Music Generation Workflow', () => {
    it('should complete full workflow from health check to download', fakeAsync(() => {
      // Step 1: Health check on component init
      fixture.detectChanges();
      
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      expect(healthReq.request.method).toBe('GET');
      healthReq.flush({
        status: 'healthy',
        service: 'music-ai-generator-backend'
      });
      
      tick();
      expect(component.isServerOnline).toBe(true);

      // Step 2: Fill form and submit
      component.musicForm.patchValue({
        prompt: 'relaxing piano melody for meditation',
        duration: 60
      });

      component.onSubmit();

      // Step 3: Handle generation request
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(generateReq.request.method).toBe('POST');
      expect(generateReq.request.body).toEqual({
        prompt: 'relaxing piano melody for meditation',
        duration: 60
      });

      const mockGenerationResponse = {
        success: true,
        message: 'Music generation started',
        track_id: 'track_integration_test',
        prompt: 'relaxing piano melody for meditation',
        duration: 60,
        estimated_processing_time: 45,
        status: 'processing',
        download_url: null
      };

      generateReq.flush(mockGenerationResponse);
      tick();

      expect(component.isGenerating).toBe(true);

      // Step 4: First polling request (processing)
      const statusReq1 = httpMock.expectOne(`${baseURL}/music/status/track_integration_test`);
      expect(statusReq1.request.method).toBe('GET');
      
      const mockProcessingStatus = {
        track_id: 'track_integration_test',
        status: 'processing',
        progress: 25,
        prompt: 'relaxing piano melody for meditation',
        duration: 60,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: null
      };

      statusReq1.flush(mockProcessingStatus);
      tick(2000); // Wait for polling interval

      expect(component.currentTrack?.progress).toBe(25);
      expect(component.currentTrack?.status).toBe('processing');

      // Step 5: Second polling request (more progress)
      const statusReq2 = httpMock.expectOne(`${baseURL}/music/status/track_integration_test`);
      
      const mockProgressStatus = {
        ...mockProcessingStatus,
        progress: 75
      };

      statusReq2.flush(mockProgressStatus);
      tick(2000);

      expect(component.currentTrack?.progress).toBe(75);

      // Step 6: Final polling request (completed)
      const statusReq3 = httpMock.expectOne(`${baseURL}/music/status/track_integration_test`);
      
      const mockCompletedStatus = {
        track_id: 'track_integration_test',
        status: 'completed',
        progress: 100,
        prompt: 'relaxing piano melody for meditation',
        duration: 60,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://127.0.0.1:8000/downloads/track_integration_test.mp3'
      };

      statusReq3.flush(mockCompletedStatus);
      tick();

      // Step 7: Verify completion
      expect(component.isGenerating).toBe(false);
      expect(component.currentTrack?.status).toBe('completed');
      expect(component.currentTrack?.progress).toBe(100);
      expect(component.currentTrack?.download_url).toContain('.mp3');

      // Step 8: Test download functionality
      spyOn(window, 'open');
      component.downloadTrack();
      expect(window.open).toHaveBeenCalledWith(
        'http://127.0.0.1:8000/downloads/track_integration_test.mp3',
        '_blank'
      );
    }));

    it('should handle failed generation workflow', fakeAsync(() => {
      // Health check
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });
      tick();

      // Submit form
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });
      component.onSubmit();

      // Generation request
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_failed_test',
        prompt: 'test prompt',
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
      tick();

      // Failed status
      const statusReq = httpMock.expectOne(`${baseURL}/music/status/track_failed_test`);
      statusReq.flush({
        track_id: 'track_failed_test',
        status: 'failed',
        progress: 0,
        prompt: 'test prompt',
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: null
      });
      tick();

      expect(component.isGenerating).toBe(false);
      expect(component.currentTrack?.status).toBe('failed');
    }));

    it('should handle server connection issues', fakeAsync(() => {
      // Simulate server connection failure
      fixture.detectChanges();
      
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush(null, { status: 0, statusText: 'Network error' });
      tick();

      expect(component.isServerOnline).toBe(false);
      expect(component.error).toContain('Cannot connect to server');

      // Form should be disabled
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      
      // No HTTP requests should be made for generation
      httpMock.expectNone(`${baseURL}/music/generate`);
    }));

    it('should handle generation errors gracefully', fakeAsync(() => {
      // Health check succeeds
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });
      tick();

      // Submit form
      component.musicForm.patchValue({
        prompt: '',
        duration: 30
      });
      component.onSubmit();

      // Generation fails with validation error
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq.flush({
        detail: [
          {
            loc: ['body', 'prompt'],
            msg: 'ensure this value has at least 1 characters',
            type: 'value_error.any_str.min_length'
          }
        ]
      }, { status: 422, statusText: 'Validation error' });
      tick();

      expect(component.isGenerating).toBe(false);
      expect(component.error).toContain('Invalid input parameters');
    }));
  });

  describe('Form Validation Integration', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });
      tick();
    }));

    it('should prevent submission with invalid prompt', () => {
      component.musicForm.patchValue({
        prompt: '',
        duration: 30
      });

      component.onSubmit();

      // No HTTP request should be made
      httpMock.expectNone(`${baseURL}/music/generate`);
      expect(component.isGenerating).toBe(false);
    });

    it('should prevent submission with invalid duration', () => {
      component.musicForm.patchValue({
        prompt: 'valid prompt',
        duration: 400 // Exceeds max limit
      });

      component.onSubmit();

      httpMock.expectNone(`${baseURL}/music/generate`);
      expect(component.isGenerating).toBe(false);
    });

    it('should sanitize prompt before sending', fakeAsync(() => {
      component.musicForm.patchValue({
        prompt: '  <script>alert("hack")</script>clean music  ',
        duration: 30
      });

      component.onSubmit();

      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(generateReq.request.body.prompt).toBe('clean music');
      
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_sanitized',
        prompt: 'clean music',
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
      tick();
    }));
  });

  describe('Error Recovery', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });
      tick();
    }));

    it('should recover from generation errors', fakeAsync(() => {
      // First attempt fails
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });
      component.onSubmit();

      const generateReq1 = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq1.flush(
        { detail: 'Server error' },
        { status: 500, statusText: 'Internal Server Error' }
      );
      tick();

      expect(component.error).toContain('Server error');
      expect(component.isGenerating).toBe(false);

      // Second attempt succeeds
      component.onSubmit();

      const generateReq2 = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq2.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_recovery',
        prompt: 'test prompt',
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
      tick();

      expect(component.error).toBeNull();
      expect(component.isGenerating).toBe(true);

      // Complete the successful generation
      const statusReq = httpMock.expectOne(`${baseURL}/music/status/track_recovery`);
      statusReq.flush({
        track_id: 'track_recovery',
        status: 'completed',
        progress: 100,
        prompt: 'test prompt',
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://127.0.0.1:8000/downloads/track_recovery.mp3'
      });
      tick();

      expect(component.isGenerating).toBe(false);
      expect(component.currentTrack?.status).toBe('completed');
    }));

    it('should reset state properly', () => {
      // Set up some state
      component.isGenerating = true;
      component.error = 'Some error';
      component.currentTrack = {
        track_id: 'test',
        status: 'completed',
        progress: 100,
        prompt: 'test',
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'test.mp3'
      };
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 60
      });

      // Reset
      component.reset();

      // Verify reset
      expect(component.isGenerating).toBe(false);
      expect(component.error).toBeNull();
      expect(component.currentTrack).toBeNull();
      expect(component.musicForm.get('prompt')?.value).toBe('');
      expect(component.musicForm.get('duration')?.value).toBe(30);
    });
  });

  describe('Example Prompts Integration', () => {
    beforeEach(fakeAsync(() => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });
      tick();
    }));

    it('should use example prompt and generate music', fakeAsync(() => {
      const examplePrompt = component.examplePrompts[0];
      component.useExamplePrompt(examplePrompt);

      expect(component.musicForm.get('prompt')?.value).toBe(examplePrompt);

      component.onSubmit();

      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(generateReq.request.body.prompt).toBe(examplePrompt);
      
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_example',
        prompt: examplePrompt,
        duration: 30,
        estimated_processing_time: 15,
        status: 'processing',
        download_url: null
      });
      tick();

      expect(component.isGenerating).toBe(true);

      // Complete the generation
      const statusReq = httpMock.expectOne(`${baseURL}/music/status/track_example`);
      statusReq.flush({
        track_id: 'track_example',
        status: 'completed',
        progress: 100,
        prompt: examplePrompt,
        duration: 30,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://127.0.0.1:8000/downloads/track_example.mp3'
      });
      tick();

      expect(component.currentTrack?.status).toBe('completed');
    }));
  });
});
