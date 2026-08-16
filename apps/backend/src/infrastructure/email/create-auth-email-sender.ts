import type { AppConfig } from '../config/config.js';
import {
  ResendAuthEmailSender,
  UnavailableAuthEmailSender,
  type AuthEmailSender,
} from './auth-email-sender.js';

export function createAuthEmailSender(config: AppConfig): AuthEmailSender {
  if (config.resendApiKey && config.emailFrom) {
    return new ResendAuthEmailSender(config.resendApiKey, config.emailFrom);
  }

  return new UnavailableAuthEmailSender();
}
