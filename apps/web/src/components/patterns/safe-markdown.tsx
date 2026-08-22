// Shared public entry point so patient delivery and admin preview use the same
// constrained renderer and never drift into unsanitized HTML.
export { SafeMarkdown } from '@/features/patient/support/safe-markdown';
