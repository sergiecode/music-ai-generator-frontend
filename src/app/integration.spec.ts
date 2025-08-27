import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

import { GeneratorComponent } from './pages/generator/generator.component';
import { MusicService } from './services/music.service';

describe('Integration Tests - Complete Music Generation Workflow', () => {
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
    it('should complete full workflow from health check to download', (done) => {
      // Step 1: Health check on component init
      fixture.detectChanges();
      
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      expect(healthReq.request.method).toBe('GET');
      healthReq.flush({
        status: 'healthy',
        service: 'music-ai-generator-backend'
      });
      
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

      generateReq.flush({
        success: true,
        message: 'Music generation started',
        track_id: 'track_integration_test',
        prompt: 'relaxing piano melody for meditation',
        duration: 60,
        estimated_processing_time: 45,
        status: 'processing',
        download_url: null
      });

      expect(component.isGenerating).toBe(true);

      // Step 4: First polling request (processing)
      setTimeout(() => {
        const statusReq1 = httpMock.expectOne(`${baseURL}/music/status/track_integration_test`);
        expect(statusReq1.request.method).toBe('GET');
        
        statusReq1.flush({
          track_id: 'track_integration_test',
          status: 'processing',
          progress: 75,
          prompt: 'relaxing piano melody for meditation',
          duration: 60,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: null
        });

        expect(component.currentTrack?.progress).toBe(75);
        expect(component.currentTrack?.status).toBe('processing');

        // Step 5: Second polling request (completed)
        setTimeout(() => {
          const statusReq2 = httpMock.expectOne(`${baseURL}/music/status/track_integration_test`);
          
          statusReq2.flush({
            track_id: 'track_integration_test',
            status: 'completed',
            progress: 100,
            prompt: 'relaxing piano melody for meditation',
            duration: 60,
            created_at: '2025-08-27T10:30:00Z',
            estimated_completion: '2025-08-27T10:31:00Z',
            download_url: 'http://example.com/track_integration_test.mp3'
          });

          expect(component.currentTrack?.status).toBe('completed');
          expect(component.currentTrack?.progress).toBe(100);
          expect(component.currentTrack?.download_url).toBe('http://example.com/track_integration_test.mp3');
          expect(component.isGenerating).toBe(false);
          expect(component.musicForm.enabled).toBe(true);
          
          done();
        }, 2100);
      }, 2100);
    });

    it('should handle server offline scenario', () => {
      fixture.detectChanges();
      
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.error(new ErrorEvent('Network error'));
      
      expect(component.isServerOnline).toBe(false);
      expect(component.error).toContain('Cannot connect to server');
    });

    it('should handle generation failure gracefully', () => {
      // Health check success
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      // Fill form and submit
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();

      // Generation fails
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq.flush(
        { detail: 'Server overloaded' },
        { status: 500, statusText: 'Internal Server Error' }
      );

      expect(component.isGenerating).toBe(false);
      expect(component.error).toContain('Server error');
      expect(component.musicForm.enabled).toBe(true);
    });

    it('should handle track generation failure during polling', (done) => {
      // Health check and generation success
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();

      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_fail_test',
        prompt: 'test prompt',
        duration: 30,
        estimated_processing_time: 20,
        status: 'processing',
        download_url: null
      });

      // Polling returns failed status
      setTimeout(() => {
        const statusReq = httpMock.expectOne(`${baseURL}/music/status/track_fail_test`);
        
        statusReq.flush({
          track_id: 'track_fail_test',
          status: 'failed',
          progress: 0,
          prompt: 'test prompt',
          duration: 30,
          created_at: '2025-08-27T10:30:00Z',
          estimated_completion: '2025-08-27T10:31:00Z',
          download_url: null
        });

        expect(component.currentTrack?.status).toBe('failed');
        expect(component.isGenerating).toBe(false);
        expect(component.error).toContain('Music generation failed');
        expect(component.musicForm.enabled).toBe(true);
        
        done();
      }, 2100);
    });

    it('should handle form validation errors', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      // Try to submit with invalid form
      component.musicForm.patchValue({
        prompt: '', // Invalid - empty
        duration: 30
      });

      component.onSubmit();

      // No HTTP requests should be made
      httpMock.expectNone(`${baseURL}/music/generate`);
      expect(component.isGenerating).toBe(false);
    });

    it('should handle input sanitization during generation', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      // Submit with potentially dangerous input
      component.musicForm.patchValue({
        prompt: '<script>alert("xss")</script>relaxing music',
        duration: 30
      });

      component.onSubmit();

      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      // Verify the prompt was sanitized
      expect(generateReq.request.body.prompt).toBe('relaxing music');
      
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_sanitized',
        prompt: 'relaxing music',
        duration: 30,
        estimated_processing_time: 20,
        status: 'processing',
        download_url: null
      });
    });
  });

  describe('Error Recovery and User Experience', () => {
    it('should allow retry after error', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      // First attempt fails
      component.onSubmit();
      const generateReq1 = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq1.flush({}, { status: 500, statusText: 'Server Error' });

      expect(component.isGenerating).toBe(false);
      expect(component.error).toBeTruthy();
      expect(component.musicForm.enabled).toBe(true);

      // Clear error and retry
      component.clearError();
      expect(component.error).toBeNull();

      // Second attempt succeeds
      component.onSubmit();
      const generateReq2 = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq2.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_retry',
        prompt: 'test prompt',
        duration: 30,
        estimated_processing_time: 20,
        status: 'processing',
        download_url: null
      });

      expect(component.isGenerating).toBe(true);
      expect(component.error).toBeNull();
    });

    it('should reset state for new generation', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      // Set up some state from previous generation
      component.currentTrack = {
        track_id: 'old_track',
        status: 'completed',
        progress: 100,
        prompt: 'old prompt',
        duration: 60,
        created_at: '2025-08-27T10:30:00Z',
        estimated_completion: '2025-08-27T10:31:00Z',
        download_url: 'http://example.com/old_track.mp3'
      };

      component.reset();

      expect(component.currentTrack).toBeNull();
      expect(component.error).toBeNull();
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.get('prompt')?.value).toBe('');
      expect(component.musicForm.get('duration')?.value).toBe(30);
    });

    it('should handle example prompts correctly', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      const examplePrompt = 'relaxing piano melody for meditation';
      component.useExamplePrompt(examplePrompt);

      expect(component.musicForm.get('prompt')?.value).toBe(examplePrompt);
      expect(component.error).toBeNull();

      // Should be able to generate with example prompt
      component.onSubmit();
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      expect(generateReq.request.body.prompt).toBe(examplePrompt);
      
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_example',
        prompt: examplePrompt,
        duration: 30,
        estimated_processing_time: 20,
        status: 'processing',
        download_url: null
      });
    });
  });

  describe('Real-world Scenarios', () => {
    it('should handle slow network responses', (done) => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      component.musicForm.patchValue({
        prompt: 'ambient space music',
        duration: 120
      });

      component.onSubmit();

      // Simulate slow generation response
      setTimeout(() => {
        const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
        generateReq.flush({
          success: true,
          message: 'Generation started',
          track_id: 'track_slow',
          prompt: 'ambient space music',
          duration: 120,
          estimated_processing_time: 90,
          status: 'processing',
          download_url: null
        });

        expect(component.isGenerating).toBe(true);
        done();
      }, 1000);
    });

    it('should handle multiple rapid submissions gracefully', () => {
      fixture.detectChanges();
      const healthReq = httpMock.expectOne(`${baseURL}/health`);
      healthReq.flush({ status: 'healthy', service: 'music-ai-generator-backend' });

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      // First submission
      component.onSubmit();
      expect(component.isGenerating).toBe(true);

      // Try to submit again while first is processing
      component.onSubmit();

      // Should only have one HTTP request
      const generateReq = httpMock.expectOne(`${baseURL}/music/generate`);
      generateReq.flush({
        success: true,
        message: 'Generation started',
        track_id: 'track_rapid',
        prompt: 'test prompt',
        duration: 30,
        estimated_processing_time: 20,
        status: 'processing',
        download_url: null
      });

      // No additional requests should be made
      httpMock.expectNone(`${baseURL}/music/generate`);
    });
  });
});
