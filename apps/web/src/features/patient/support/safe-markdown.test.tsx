import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SafeMarkdown } from './safe-markdown';

describe('SafeMarkdown', () => {
  it('renders constrained formatting without executing raw HTML', () => {
    render(
      <SafeMarkdown
        value={'# Heading\n\n<script>alert(1)</script>\n\n**A small step**'}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Heading' })).toBeVisible();
    expect(screen.getByText('<script>alert(1)</script>')).toBeVisible();
    expect(screen.getByText('A small step')).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
  });

  it('rejects javascript and data links while retaining safe https links', () => {
    render(
      <SafeMarkdown
        value={
          '[safe](https://example.com) [bad](javascript:alert(1)) [data](data:text/html,bad)'
        }
      />,
    );

    expect(screen.getByRole('link', { name: 'safe' })).toHaveAttribute(
      'href',
      'https://example.com',
    );
    expect(screen.queryByRole('link', { name: 'bad' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'data' })).toBeNull();
    expect(document.querySelector('[onclick]')).toBeNull();
  });
});
