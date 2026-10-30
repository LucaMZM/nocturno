import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../store/auth.store';
import { canAccessRole } from '../role-access';

export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.bootstrap();
  return auth.user() ? true : router.createUrlTree(['/error/401'],
    { queryParams: { returnUrl: state.url } });
};

export const roleGuard: CanActivateFn = async (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  await auth.bootstrap();
  if (!auth.user()) return router.createUrlTree(['/error/401'],
    { queryParams: { returnUrl: state.url } });
  const roles = route.data['roles'] as Array<UserRole> | undefined;
  return canAccessRole(auth.user(), roles) ? true : router.createUrlTree(['/error/403']);
};

type UserRole = 'USER' | 'PROMOTER' | 'ADMIN';
