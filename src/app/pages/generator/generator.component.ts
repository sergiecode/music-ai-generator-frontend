import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { MusicService, TrackStatus, MusicGenerationRequest } from '../../services/music.service';

@Component({
  selector: 'app-generator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './generator.component.html',
  styleUrls: ['./generator.component.scss']
})
export class GeneratorComponent implements OnInit, OnDestroy {
  musicForm: FormGroup;
  isGenerating = false;
  currentTrack: TrackStatus | null = null;
  error: string | null = null;
  isServerOnline = false;
  
  private subscription = new Subscription();

  // Duration options for the slider
  readonly durationOptions = [
    { value: 5, label: '5 sec' },
    { value: 15, label: '15 sec' },
    { value: 30, label: '30 sec' },
    { value: 60, label: '1 min' },
    { value: 90, label: '1.5 min' },
    { value: 120, label: '2 min' },
    { value: 180, label: '3 min' },
    { value: 300, label: '5 min' }
  ];

  // Example prompts to help users
  readonly examplePrompts = [
    'relaxing piano melody for meditation',
    'upbeat electronic dance music',
    'classical guitar peaceful and calm',
    'jazz saxophone smooth and soulful',
    'ambient space music with synthesizers',
    'folk acoustic guitar with nature sounds'
  ];

  constructor(
    private fb: FormBuilder,
    private musicService: MusicService
  ) {
    this.musicForm = this.fb.group({
      prompt: ['', [
        Validators.required, 
        Validators.minLength(1), 
        Validators.maxLength(500)
      ]],
      duration: [30, [
        Validators.required, 
        Validators.min(5), 
        Validators.max(300)
      ]]
    });
  }

  ngOnInit() {
    this.checkServerConnection();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  /**
   * Check if the backend server is online
   */
  async checkServerConnection() {
    try {
      this.subscription.add(
        this.musicService.checkServerHealth().subscribe({
          next: (response) => {
            this.isServerOnline = response.status === 'healthy';
            console.log('Server connection established:', response);
          },
          error: (error) => {
            this.isServerOnline = false;
            this.error = 'Cannot connect to server. Please ensure the backend is running on http://127.0.0.1:8000';
            console.error('Server connection failed:', error);
          }
        })
      );
    } catch (error) {
      this.isServerOnline = false;
      this.error = 'Cannot connect to server. Please ensure the backend is running.';
    }
  }

  /**
   * Handle form submission
   */
  onSubmit() {
    if (this.musicForm.valid && !this.isGenerating && this.isServerOnline) {
      this.generateMusic();
    }
  }

  /**
   * Generate music based on the form data
   */
  private generateMusic() {
    this.isGenerating = true;
    this.error = null;
    this.currentTrack = null;

    const request: MusicGenerationRequest = {
      prompt: this.musicForm.value.prompt.trim(),
      duration: this.musicForm.value.duration
    };

    console.log('Starting music generation with request:', request);

    this.subscription.add(
      this.musicService.generateMusic(request).subscribe({
        next: (response) => {
          console.log('Generation started:', response);
          this.startPolling(response.track_id);
        },
        error: (error) => {
          console.error('Generation failed:', error);
          this.error = error.message;
          this.isGenerating = false;
        }
      })
    );
  }

  /**
   * Start polling for track status updates
   */
  private startPolling(trackId: string) {
    console.log('Starting to poll track status for:', trackId);
    
    this.subscription.add(
      this.musicService.pollTrackStatus(trackId).subscribe({
        next: (status) => {
          console.log('Track status update:', status);
          this.currentTrack = status;
          
          if (status.status === 'completed') {
            this.isGenerating = false;
            console.log('Generation completed!', status);
          } else if (status.status === 'failed') {
            this.error = 'Music generation failed. Please try again.';
            this.isGenerating = false;
          }
        },
        error: (error) => {
          console.error('Polling failed:', error);
          this.error = error.message;
          this.isGenerating = false;
        }
      })
    );
  }

  /**
   * Download the generated track
   */
  downloadTrack() {
    if (this.currentTrack?.download_url) {
      // Create a temporary link element to download the file
      const link = document.createElement('a');
      link.href = this.currentTrack.download_url;
      link.download = `generated_music_${this.currentTrack.track_id}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  /**
   * Reset the form and state to generate another track
   */
  reset() {
    this.currentTrack = null;
    this.error = null;
    this.isGenerating = false;
    this.musicForm.reset({ 
      prompt: '', 
      duration: 30 
    });
  }

  /**
   * Use an example prompt
   */
  useExamplePrompt(prompt: string) {
    this.musicForm.patchValue({ prompt });
  }

  /**
   * Clear the current error
   */
  clearError() {
    this.error = null;
  }

  /**
   * Get form field error message
   */
  getErrorMessage(fieldName: string): string {
    const field = this.musicForm.get(fieldName);
    if (field?.errors && field.touched) {
      if (field.errors['required']) {
        return `${fieldName} is required`;
      }
      if (field.errors['minlength']) {
        return `${fieldName} must be at least ${field.errors['minlength'].requiredLength} characters`;
      }
      if (field.errors['maxlength']) {
        return `${fieldName} must not exceed ${field.errors['maxlength'].requiredLength} characters`;
      }
      if (field.errors['min']) {
        return `${fieldName} must be at least ${field.errors['min'].min}`;
      }
      if (field.errors['max']) {
        return `${fieldName} must not exceed ${field.errors['max'].max}`;
      }
    }
    return '';
  }

  /**
   * Check if a form field has errors and is touched
   */
  hasFieldError(fieldName: string): boolean {
    const field = this.musicForm.get(fieldName);
    return !!(field?.errors && field.touched);
  }

  /**
   * Get progress percentage as a string
   */
  get progressPercentage(): string {
    return this.currentTrack ? `${this.currentTrack.progress}%` : '0%';
  }

  /**
   * Get status badge class based on current status
   */
  getStatusBadgeClass(): string {
    if (!this.currentTrack) return '';
    
    switch (this.currentTrack.status) {
      case 'processing':
        return 'badge-processing';
      case 'completed':
        return 'badge-success';
      case 'failed':
        return 'badge-error';
      default:
        return '';
    }
  }
}
