import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { of, throwError, Subject } from 'rxjs';

import { GeneratorComponent } from './generator.component';
import { MusicService, TrackStatus, MusicGenerationResponse, HealthResponse } from '../../services/music.service';

describe('GeneratorComponent', () => {
  let component: GeneratorComponent;
  let fixture: ComponentFixture<GeneratorComponent>;
  let mockMusicService: jasmine.SpyObj<MusicService>;
  let progressSubject: Subject<TrackStatus>;

  const mockHealthResponse: HealthResponse = {
    status: 'healthy',
    service: 'music-ai-generator-backend'
  };

  const mockGenerationResponse: MusicGenerationResponse = {
    success: true,
    message: 'Music generation started',
    track_id: 'track_test123',
    prompt: 'test music prompt',
    duration: 30,
    estimated_processing_time: 15,
    status: 'processing',
    download_url: null
  };

  const mockProcessingStatus: TrackStatus = {
    track_id: 'track_test123',
    status: 'processing',
    progress: 50,
    prompt: 'test music prompt',
    duration: 30,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: null
  };

  const mockCompletedStatus: TrackStatus = {
    track_id: 'track_test123',
    status: 'completed',
    progress: 100,
    prompt: 'test music prompt',
    duration: 30,
    created_at: '2025-08-27T10:30:00Z',
    estimated_completion: '2025-08-27T10:31:00Z',
    download_url: 'http://127.0.0.1:8000/downloads/track_test123.mp3'
  };

  beforeEach(async () => {
    progressSubject = new Subject<TrackStatus>();

    const musicServiceSpy = jasmine.createSpyObj('MusicService', [
      'checkServerHealth',
      'generateMusic',
      'getTrackStatus',
      'pollTrackStatus',
      'getProgressUpdates'
    ]);

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
    mockMusicService = TestBed.inject(MusicService) as jasmine.SpyObj<MusicService>;

    // Default spy behaviors
    mockMusicService.checkServerHealth.and.returnValue(of(mockHealthResponse));
    mockMusicService.getProgressUpdates.and.returnValue(progressSubject.asObservable());
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

    it('should have example prompts available', () => {
      expect(component.examplePrompts).toBeTruthy();
      expect(component.examplePrompts.length).toBeGreaterThan(0);
      expect(component.examplePrompts[0]).toContain('relaxing piano melody');
    });

    it('should have duration options available', () => {
      expect(component.durationOptions).toBeTruthy();
      expect(component.durationOptions.length).toBeGreaterThan(0);
      expect(component.durationOptions.find(opt => opt.value === 30)).toBeTruthy();
    });

    it('should check server connection on init', () => {
      fixture.detectChanges();
      expect(mockMusicService.checkServerHealth).toHaveBeenCalled();
    });
  });

  describe('Server Connection', () => {
    it('should set server online when health check succeeds', fakeAsync(() => {
      mockMusicService.checkServerHealth.and.returnValue(of(mockHealthResponse));
      
      fixture.detectChanges();
      tick();

      expect(component.isServerOnline).toBe(true);
      expect(component.error).toBeNull();
    }));

    it('should set server offline when health check fails', fakeAsync(() => {
      mockMusicService.checkServerHealth.and.returnValue(
        throwError(() => new Error('Connection failed'))
      );
      
      fixture.detectChanges();
      tick();

      expect(component.isServerOnline).toBe(false);
      expect(component.error).toContain('Cannot connect to server');
    }));

    it('should display server status in template', () => {
      component.isServerOnline = true;
      fixture.detectChanges();

      const statusElement = fixture.nativeElement.querySelector('.server-status');
      expect(statusElement).toBeTruthy();
    });
  });

  describe('Form Validation', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should require prompt', () => {
      const promptControl = component.musicForm.get('prompt');
      promptControl?.setValue('');
      promptControl?.markAsTouched();

      expect(promptControl?.invalid).toBe(true);
      expect(promptControl?.errors?.['required']).toBe(true);
    });

    it('should validate prompt length', () => {
      const promptControl = component.musicForm.get('prompt');
      
      // Test minimum length
      promptControl?.setValue('');
      expect(promptControl?.errors?.['minlength']).toBeTruthy();

      // Test maximum length
      const longPrompt = 'a'.repeat(501);
      promptControl?.setValue(longPrompt);
      expect(promptControl?.errors?.['maxlength']).toBeTruthy();

      // Test valid length
      promptControl?.setValue('valid prompt');
      expect(promptControl?.errors).toBeNull();
    });

    it('should validate duration range', () => {
      const durationControl = component.musicForm.get('duration');
      
      // Test minimum
      durationControl?.setValue(4);
      expect(durationControl?.errors?.['min']).toBeTruthy();

      // Test maximum
      durationControl?.setValue(301);
      expect(durationControl?.errors?.['max']).toBeTruthy();

      // Test valid value
      durationControl?.setValue(60);
      expect(durationControl?.errors).toBeNull();
    });

    it('should disable form when generating', () => {
      component.isGenerating = true;
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton.disabled).toBe(true);
    });

    it('should disable form when server is offline', () => {
      component.isServerOnline = false;
      fixture.detectChanges();

      const submitButton = fixture.nativeElement.querySelector('button[type="submit"]');
      expect(submitButton.disabled).toBe(true);
    });
  });

  describe('Music Generation', () => {
    beforeEach(() => {
      component.isServerOnline = true;
      fixture.detectChanges();
    });

    it('should generate music when form is valid', fakeAsync(() => {
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(of(mockProcessingStatus));

      component.musicForm.patchValue({
        prompt: 'test music prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(mockMusicService.generateMusic).toHaveBeenCalledWith({
        prompt: 'test music prompt',
        duration: 30
      });
      expect(component.isGenerating).toBe(true);
    }));

    it('should not generate when form is invalid', () => {
      component.musicForm.patchValue({
        prompt: '',
        duration: 30
      });

      component.onSubmit();

      expect(mockMusicService.generateMusic).not.toHaveBeenCalled();
      expect(component.isGenerating).toBe(false);
    });

    it('should not generate when already generating', () => {
      component.isGenerating = true;
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();

      expect(mockMusicService.generateMusic).not.toHaveBeenCalled();
    });

    it('should not generate when server is offline', () => {
      component.isServerOnline = false;
      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();

      expect(mockMusicService.generateMusic).not.toHaveBeenCalled();
    });

    it('should handle generation errors', fakeAsync(() => {
      const errorMessage = 'Generation failed';
      mockMusicService.generateMusic.and.returnValue(
        throwError(() => new Error(errorMessage))
      );

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(component.error).toBe(errorMessage);
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.enabled).toBe(true);
    }));
  });

  describe('Progress Tracking', () => {
    beforeEach(() => {
      component.isServerOnline = true;
      fixture.detectChanges();
    });

    it('should start polling after successful generation', fakeAsync(() => {
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(of(mockProcessingStatus));

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(mockMusicService.pollTrackStatus).toHaveBeenCalledWith('track_test123');
    }));

    it('should update progress during polling', fakeAsync(() => {
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(of(mockProcessingStatus));

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(component.currentTrack).toEqual(mockProcessingStatus);
    }));

    it('should stop generating when track completes', fakeAsync(() => {
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(of(mockCompletedStatus));

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(component.isGenerating).toBe(false);
      expect(component.currentTrack?.status).toBe('completed');
    }));

    it('should handle polling errors', fakeAsync(() => {
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(
        throwError(() => new Error('Polling failed'))
      );

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(component.error).toBe('Polling failed');
      expect(component.isGenerating).toBe(false);
      expect(component.musicForm.enabled).toBe(true);
    }));
  });

  describe('Download Functionality', () => {
    it('should download track when URL is available', () => {
      // Mock document.createElement and link.click
      const mockLink = jasmine.createSpyObj('HTMLAnchorElement', ['click'], {
        href: '',
        download: ''
      });
      spyOn(document, 'createElement').and.returnValue(mockLink);
      spyOn(document.body, 'appendChild');
      spyOn(document.body, 'removeChild');
      
      component.currentTrack = mockCompletedStatus;

      component.downloadTrack();

      expect(document.createElement).toHaveBeenCalledWith('a');
      expect(mockLink.href).toBe('http://127.0.0.1:8000/downloads/track_test123.mp3');
      expect(mockLink.download).toBe('generated_music_track_test123.mp3');
      expect(mockLink.click).toHaveBeenCalled();
      expect(document.body.appendChild).toHaveBeenCalledWith(mockLink);
      expect(document.body.removeChild).toHaveBeenCalledWith(mockLink);
    });

    it('should not download when no URL available', () => {
      spyOn(document, 'createElement');
      component.currentTrack = mockProcessingStatus; // No download URL

      component.downloadTrack();

      expect(document.createElement).not.toHaveBeenCalled();
    });

    it('should not download when no current track', () => {
      spyOn(window, 'open');
      component.currentTrack = null;

      component.downloadTrack();

      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('Reset Functionality', () => {
    it('should reset component state', () => {
      // Set some state
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

  describe('Example Prompts', () => {
    it('should use example prompt', () => {
      const examplePrompt = component.examplePrompts[0];
      component.useExamplePrompt(examplePrompt);

      expect(component.musicForm.get('prompt')?.value).toBe(examplePrompt);
    });

    it('should clear error when using example prompt', () => {
      component.error = 'Some error';
      const examplePrompt = component.examplePrompts[0];
      
      component.useExamplePrompt(examplePrompt);

      expect(component.error).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should display error messages', () => {
      component.error = 'Test error message';
      fixture.detectChanges();

      const errorElement = fixture.nativeElement.querySelector('.error-display');
      expect(errorElement).toBeTruthy();
      expect(errorElement.textContent).toContain('Test error message');
    });

    it('should clear error on successful generation start', fakeAsync(() => {
      component.error = 'Previous error';
      mockMusicService.generateMusic.and.returnValue(of(mockGenerationResponse));
      mockMusicService.pollTrackStatus.and.returnValue(of(mockProcessingStatus));

      component.musicForm.patchValue({
        prompt: 'test prompt',
        duration: 30
      });

      component.onSubmit();
      tick();

      expect(component.error).toBeNull();
    }));
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
      expect(submitButton.textContent.trim()).toContain('Generating');
    });

    it('should show progress when track is available', () => {
      component.currentTrack = mockProcessingStatus;
      fixture.detectChanges();

      const progressElement = fixture.nativeElement.querySelector('.progress-display');
      expect(progressElement).toBeTruthy();
    });

    it('should show download button when track is completed', () => {
      component.currentTrack = mockCompletedStatus;
      fixture.detectChanges();

      const downloadButton = fixture.nativeElement.querySelector('.download-btn');
      expect(downloadButton).toBeTruthy();
      expect(downloadButton.textContent).toContain('Download');
    });

    it('should show example prompts', () => {
      const exampleElements = fixture.nativeElement.querySelectorAll('.example-prompt');
      expect(exampleElements.length).toBe(component.examplePrompts.length);
    });
  });

  describe('Component Lifecycle', () => {
    it('should unsubscribe on destroy', () => {
      const subscription = component['subscription'];
      spyOn(subscription, 'unsubscribe');

      component.ngOnDestroy();

      expect(subscription.unsubscribe).toHaveBeenCalled();
    });

    it('should check server on init', () => {
      expect(mockMusicService.checkServerHealth).toHaveBeenCalled();
    });
  });

  describe('Form Interactions', () => {
    beforeEach(() => {
      fixture.detectChanges();
    });

    it('should update form when duration slider changes', () => {
      const newDuration = 60;
      component.musicForm.patchValue({ duration: newDuration });

      expect(component.musicForm.get('duration')?.value).toBe(newDuration);
    });

    it('should validate form on submit attempt', () => {
      component.musicForm.patchValue({
        prompt: '',
        duration: 30
      });

      const formElement = fixture.nativeElement.querySelector('form');
      formElement.dispatchEvent(new Event('submit'));

      expect(component.musicForm.get('prompt')?.touched).toBe(true);
    });
  });
});
