import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UsersService,
  type UserWithAccess,
} from '../../modules/identity/users.service';
import { PasswordService } from './password.service';

/**
 * Provider-agnostic credential auth. `AuthService` depends on this interface,
 * not on a concrete provider, so an OIDC/Okta provider (Phase 2) can be added
 * as another implementation without touching the controller, guards, or
 * token/session machinery.
 */
export interface CredentialAuthProvider {
  readonly kind: 'LOCAL' | 'OIDC';
  authenticate(input: {
    email: string;
    password: string;
  }): Promise<UserWithAccess>;
}

@Injectable()
export class LocalAuthProvider implements CredentialAuthProvider {
  readonly kind = 'LOCAL' as const;

  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordService,
  ) {}

  async authenticate(input: {
    email: string;
    password: string;
  }): Promise<UserWithAccess> {
    const user = await this.users.findByEmailWithAccess(input.email);
    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.passwords.verify(
      user.passwordHash,
      input.password,
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return user;
  }
}
