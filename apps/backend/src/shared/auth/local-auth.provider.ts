import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  UsersService,
  type UserWithAccess,
} from '../../modules/identity/users.service';
import { PasswordService } from './password.service';

/** AuthService depends on this interface so other providers can be added without touching it. */
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
