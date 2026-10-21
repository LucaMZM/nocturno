import { ErrorHandler, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

@Injectable()
export class NocturnoErrorHandler implements ErrorHandler {
  private readonly router = inject(Router);
  private navigating = false;

  handleError(_error: unknown): void {
    // Only uncaught application errors reach this handler. Recoverable HTTP failures
    // remain in their store/page, close to the action that can be retried safely.
    console.error('Unexpected application error');
    if (this.navigating || this.router.url.startsWith('/error/')) return;
    this.navigating = true;
    const returnUrl = this.router.url;
    setTimeout(() => {
      void this.router.navigate(['/error/500'], {
        queryParams: { returnUrl }, replaceUrl: true,
      }).then(
        () => { this.navigating = false; },
        () => { this.navigating = false; console.error('Error page navigation failed'); },
      );
    }, 0);
  }
}
