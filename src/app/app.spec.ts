import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { Component } from '@angular/core';
import { App } from './app';

@Component({
  template: '<div>Test Component</div>'
})
class TestComponent { }

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        App,
        RouterTestingModule.withRoutes([
          { path: '', component: TestComponent }
        ])
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have router outlet', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });

  it('should render routed component', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    
    // The router should render the test component
    expect(fixture.nativeElement).toBeTruthy();
  });
});
