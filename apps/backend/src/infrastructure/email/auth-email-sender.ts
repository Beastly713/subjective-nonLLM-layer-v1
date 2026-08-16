import { Resend } from 'resend';

export interface AuthEmailMessage {
  email: string;
  url: string;
}

export interface AuthEmailSender {
  readonly available: boolean;
  sendVerificationEmail(message: AuthEmailMessage): Promise<void>;
  sendPasswordResetEmail(message: AuthEmailMessage): Promise<void>;
}

export class UnavailableAuthEmailSender implements AuthEmailSender {
  readonly available = false;

  async sendVerificationEmail(): Promise<void> {
    throw new Error('Authentication email delivery is unavailable.');
  }

  async sendPasswordResetEmail(): Promise<void> {
    throw new Error('Authentication email delivery is unavailable.');
  }
}

export class ResendAuthEmailSender implements AuthEmailSender {
  readonly available = true;
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    this.resend = new Resend(apiKey);
  }

  async sendVerificationEmail({ email, url }: AuthEmailMessage) {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Verify your account',
      text: `Verify your account using this secure link: ${url}`,
    });
    if (error) throw new Error('Verification email delivery failed.');
  }

  async sendPasswordResetEmail({ email, url }: AuthEmailMessage) {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Reset your password',
      text: `Reset your password using this secure link: ${url}`,
    });
    if (error) throw new Error('Password reset email delivery failed.');
  }
}

export class FakeAuthEmailSender implements AuthEmailSender {
  readonly available = true;
  readonly verificationMessages: AuthEmailMessage[] = [];
  readonly passwordResetMessages: AuthEmailMessage[] = [];

  async sendVerificationEmail(message: AuthEmailMessage) {
    this.verificationMessages.push(message);
  }

  async sendPasswordResetEmail(message: AuthEmailMessage) {
    this.passwordResetMessages.push(message);
  }
}
