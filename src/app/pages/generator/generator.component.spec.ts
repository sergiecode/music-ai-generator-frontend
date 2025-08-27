import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of, Subject, throwError, EMPTY } from 'rxjs';

import { GeneratorComponent } from './generator.component';
import { MusicService, TrackStatus, MusicGenerationResponse, HealthResponse } from '../../services/music.service';

describe('GeneratorComponent', () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let mockMusicService: jest.Mocked<MusicService>;
  let progressSubject: Subject<TrackStatus>;

  const mockHealthResponse: HealthResponse = {
    status: 'healthy',
    service: 'music-ai-generator-backend'
  };

  const mockGenerationResponse: MusicGenerationResponse = {
    success: true,
    message: 'Music generation started',
    track_id: 'track_abc123',
    prompt: 'relaxing piano melody',
    duration: 60,
    estimated_processing_time: 45,
    status: 'processing',
    download_url: null
  };

  const mockProcessingStatus: TrackStatus = {
    track_id: 'track_abc123',
    status: 'processing',
    progress: 50,
    prompt: 'relaxing piano melody',
    duration: 60,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: null
  };

  const mockCompletedStatus: TrackStatus = {
    ...mockProcessingStatus,
    status: 'completed',
    progress: 100,
    download_url: 'http://example.com/track.mp3'
  };

  beforeEach(async () => {
    progressSubject = new Subject<TrackStatus>();

    const musicServiceSpy = {
      checkServerHealth: jest.fn(),
      getServiceInfo: jest.fn(),
      generateMusic: jest.fn(),
      getTrackStatus: jest.fn(),
      pollTrackStatus: jest.fn(),
      getProgressUpdates: jest.fn()
    } as Partial<MusicService> as jest.Mocked<MusicService>;

    await TestBed.configureTestingModule({
      imports: [
        GeneratorComponent,
        ReactiveFormsModule,
        CommonModule
      ],
      providers: [
        { provide: MusicService, useValue: musicServiceSpy }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(GeneratorComponent);
    component = fixture.componentInstance;
    mockMusicService = TestBed.inject(MusicService) as jest.Mocked<MusicService>;

    // Default spy behaviors
    mockMusicService.checkServerHealth.mockReturnValue(of(mockHealthResponse));
    mockMusicService.getProgressUpdates.mockReturnValue(progressSubject.asObservable());
  });

  afterEach(() => {
    progressSubject.complete();
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize form with default values', () => {
      expect(component.musicForm).toBeTruthy();
      expect(component.musicForm.get('prompt')?.value).toBe('');
      expect(component.musicForm.get('duration')?.value).toBe(30);
    });

    it('should initialize with correct default state', () => {
      expect(component.isGenerating).toBe(false);
      expect(component.isServerOnline).toBe(false);
      expect(component.currentTrack).toBeNull();
      expect(component.error).toBeNull();
    });

    it('should have example prompts', () => {
      expect(component.examplePrompts).toBeDefined();
      expect(component.examplePrompts.length).toBeGreaterThan(0);
      expect(component.examplePrompts).toContain('relaxing piano melody for meditation');
    });

    it('should check server connection on init', () => {
      component.ngOnInit();
      expect(mockMusicService.checkServerHealth).toHaveBeenCalled();
    });
  });

  describe('Server Connection', () => {
    it('should set server online when health check succeeds', async () => {
      mockMusicService.checkServerHealth.mockReturnValue(of(mockHealthResponse));
      
      await component.checkServerConnection();
      
      expect(component.isServerOnline).toBe(true);
      expect(component.error).toBeNull();
    });

    it('should set server offline when health check fails', async () => {
      mockMusicService.checkServerHealth.mockReturnValue(
        throwError(() => new Error('Connection failed'))
      );
      
      await component.checkServerConnection();
      
      expect(component.isServerOnline).toBe(false);
      expect(component.error).toContain('Cannot connect to server');
    });

    it('should handle health check errors gracefully', async () => {
      mockMusicService.checkServerHealth.mockReturnValue(
        throwError(() => new Error('Network error'))
      );
      
      await component.checkServerConnection();
      
      expect(component.isServerOnline).toBe(false);
      expect(component.error).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should validate prompt field', () => {
      const promptControl = component.musicForm.get('prompt');
      
      // Empty prompt should be invalid
      promptControl?.setValue('');
      expect(promptControl?.invalid).toBe(true);
      
      // Valid prompt should be valid
      promptControl?.setValue('relaxing music');
      expect(promptControl?.valid).toBe(true);
      
      // Too long prompt should be invalid
      promptControl?.setValue('a'.repeat(501));
      expect(promptControl?.invalid).toBe(true);
    });

    it('should validate duration field', () => {
      const durationControl = component.musicForm.get('duration');
      
      // Too short duration should be invalid
      durationControl?.setValue(3);
      expect(durationControl?.invalid).toBe(true);
      
      // Valid duration should be valid
      durationControl?.setValue(30);
      expect(durationControl?.valid).toBe(true);
      
      // Too long duration should be invalid
      durationControl?.setValue(301);
      expect(durationControl?.invalid).toBe(true);
    });

    it('should prevent submission when form is invalid', () => {
      component.musicForm.patchValue({
        prompt: '', // Invalid
        duration: 30
      });
      
      jest.spyOn(component as any, 'generateMusic');
      
      component.onSubmit();
      
      expect((component as any).generateMusic).not.toHaveBeenCalled();
    });

    it('should allow submission when form is valid', () => {
      component.isServerOnline = true;
      component.musicForm.patchValue({
        prompt: 'valid prompt',
        duration: 30
      });
      
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.mockReturnValue(of(mockProcessingStatus));
      
      component.onSubmit();
      
      expect(mockMusicService.generateMusic).toHaveBeenCalled();
    });
  });

  describe('Music Generation', () => {
    beforeEach(() => {
      component.isServerOnline = true;
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });
      fixture.detectChanges();
    });

    it('should start music generation successfully', () => {
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      // Don't return anything from pollTrackStatus to avoid immediate status updates
      mockMusicService.pollTrackStatus.mockReturnValue(EMPTY);
      
      component.onSubmit();
      
      expect(component.isGenerating).toBe(true);
      expect(component.error).toBeNull();
      expect(component.currentTrack).toBeNull();
      expect(mockMusicService.generateMusic).toHaveBeenCalledWith({
        prompt: 'test prompt',
        duration: 30
      });
    });

    it('should handle generation errors', () => {
      mockMusicService.generateMusic.mockReturnValue(
        throwError(() => new Error('Generation failed'))
      );
      
      component.onSubmit();
      
      expect(component.isGenerating).toBe(false);
      expect(component.error).toBe('Generation failed');
      expect(component.musicForm.enabled).toBe(true);
    });

    it('should disable form during generation', () => {
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.mockReturnValue(EMPTY);
      
      component.onSubmit();
      fixture.detectChanges();
      
      const submitButton = fixture.nativeElement.querySelector('.submit-button');
      expect(submitButton.disabled).toBe(true);
    });

    it('should re-enable form after generation error', () => {
      mockMusicService.generateMusic.mockReturnValue(
        throwError(() => new Error('Generation failed'))
      );
      
      component.onSubmit();
      
      expect(component.musicForm.enabled).toBe(true);
    });
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      component.isServerOnline = true;
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });
    });

    it('should update progress during generation', () => {
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.mockReturnValue(of(mockProcessingStatus, mockCompletedStatus));
      
      component.onSubmit();
      
      expect(component.currentTrack).toEqual(mockCompletedStatus);
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.enabled).toBe(true);
    });

    it('should handle polling errors', () => {
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.mockReturnValue(
        throwError(() => new Error('Polling failed'))
      );
      
      component.onSubmit();
      
      expect(component.error).toBe('Polling failed');
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.enabled).toBe(true);
    });

    it('should handle failed track status', () => {
      const failedStatus: TrackStatus = {
        ...mockProcessingStatus,
        status: 'failed',
        progress: 0
      };
      
      mockMusicService.generateMusic.mockReturnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.mockReturnValue(of(failedStatus));
      
      component.onSubmit();
      
      expect(component.error).toContain('Music generation failed');
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.enabled).toBe(true);
    });
  });

  describe('Download Functionality', () => {
    beforeEach(() => {
      // Mock window.open
      Object.defineProperty(window, 'open', {
        writable: true,
        value: jest.fn()
      });
    });

    it('should download track when available', () => {
      // Mock document.createElement and related methods
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn()
      };
      const createElementSpy = jest.spyOn(document, 'createElement').mockReturnValue(mockLink as any);
      const appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      const removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();

      component.currentTrack = mockCompletedStatus;
      
      component.downloadTrack();
      
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe(mockCompletedStatus.download_url);
      expect(mockLink.download).toBe(`generated_music_${mockCompletedStatus.track_id}.mp3`);
      expect(mockLink.click).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);

      // Cleanup
      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });

    it('should not download when no track available', () => {
      component.currentTrack = null;
      
      component.downloadTrack();
      
      expect(window.open).not.toHaveBeenCalled();
    });

    it('should not download when no download URL', () => {
      component.currentTrack = { ...mockCompletedStatus, download_url: null };
      
      component.downloadTrack();
      
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('Example Prompts', () => {
    it('should use example prompt', () => {
      const examplePrompt = 'relaxing piano melody for meditation';
      
      component.useExamplePrompt(examplePrompt);
      
      expect(component.musicForm.get('prompt')?.value).toBe(examplePrompt);
      expect(component.error).toBeNull();
    });

    it('should clear errors when using example prompt', () => {
      component.error = 'Some error';
      
      component.useExamplePrompt('test prompt');
      
      expect(component.error).toBeNull();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset component state', () => {
      // Set up some state
      component.currentTrack = mockCompletedStatus;
      component.error = 'Some error';
      component.isGenerating = true;
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 60
      });
      
      component.reset();
      
      expect(component.currentTrack).toBeNull();
      expect(component.error).toBeNull();
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.get('prompt')?.value).toBe('');
      expect(component.musicForm.get('duration')?.value).toBe(30);
    });
  });

  describe('Error Handling', () => {
    it('should clear error', () => {
      component.error = 'Some error';
      
      component.clearError();
      
      expect(component.error).toBeNull();
    });

    it('should validate form fields correctly', () => {
      const promptControl = component.musicForm.get('prompt');
      promptControl?.setValue('');
      promptControl?.markAsTouched();
      
      expect(promptControl?.invalid).toBe(true);
      
      promptControl?.setValue('valid prompt');
      expect(promptControl?.valid).toBe(true);
    });
  });

  describe('Component Lifecycle', () => {
    it('should unsubscribe on destroy', () => {
      const unsubscribeSpy = jest.spyOn(component['subscription'], 'unsubscribe');
      
      component.ngOnDestroy();
      
      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should not have memory leaks', () => {
      const subscription = component['subscription'];
      expect(subscription.closed).toBe(false);
      
      component.ngOnDestroy();
      
      expect(subscription.closed).toBe(true);
    });
  });

  describe('UI Integration', () => {
    beforeEach(() => {
      component.isServerOnline = true;
      fixture.detectChanges();
    });

    it('should update button text when generating', () => {
      component.isGenerating = true;
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton?.textContent).toContain('Generating');
    });

    it('should show progress when track is available', () => {
      component.currentTrack = mockProcessingStatus;
      fixture.detectChanges();

      const progressElement = fixture.nativeElement.querySelector('.progress-container');
      expect(progressElement).toBeTruthy();
    });

    it('should show download button when track is completed', () => {
      component.currentTrack = mockCompletedStatus;
      fixture.detectChanges();

      const downloadButton = fixture.nativeElement.querySelector('.download-button');
      expect(downloadButton).toBeTruthy();
    });

    it('should display server status correctly', () => {
      component.isServerOnline = true;
      fixture.detectChanges();

      const statusElement = fixture.nativeElement.querySelector('.status-online');
      expect(statusElement).toBeTruthy();
    });

    it('should show error messages', () => {
      component.error = 'Test error message';
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.alert-error');
      expect(errorElement?.textContent).toContain('Test error message');
    });
  });

  describe('Form Field Validation Messages', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should show prompt validation errors', () => {
      const promptControl = component.musicForm.get('prompt');
      promptControl?.setValue('');
      promptControl?.markAsTouched();
      fixture.detectChanges();

      expect(promptControl?.invalid).toBe(true);
      expect(promptControl?.errors).toBeTruthy();
    });

    it('should show duration validation errors', () => {
      const durationControl = component.musicForm.get('duration');
      durationControl?.setValue(3); // Below minimum
      durationControl?.markAsTouched();
      fixture.detectChanges();

      expect(durationControl?.invalid).toBe(true);
      expect(durationControl?.errors).toBeTruthy();
    });

    it('should not show errors for valid fields', () => {
      const promptControl = component.musicForm.get('prompt');
      promptControl?.setValue('valid prompt');
      promptControl?.markAsTouched();

      expect(promptControl?.valid).toBe(true);
      expect(promptControl?.errors).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle null responses gracefully', () => {
      mockMusicService.checkServerHealth.mockReturnValue(of(null as any));
      
      expect(() => component.checkServerConnection()).not.toThrow();
    });

    it('should handle empty track ID', () => {
      // Set up the component for successful generation
      component.isServerOnline = true;
      component.musicForm.patchValue({ prompt: 'test prompt', duration: 30 });
      
      mockMusicService.generateMusic.mockReturnValue(of({
        ...mockGenerationResponse,
        track_id: ''
      }));
      mockMusicService.pollTrackStatus.mockReturnValue(EMPTY);
      
      component.onSubmit();
      
      // Should start generation even with empty track ID
      expect(component.isGenerating).toBe(true);
      expect(component.error).toBeNull();
    });

    it('should handle missing download URL', () => {
      component.currentTrack = {
        ...mockCompletedStatus,
        download_url: null
      };
      
      expect(() => component.downloadTrack()).not.toThrow();
    });
  });
});
