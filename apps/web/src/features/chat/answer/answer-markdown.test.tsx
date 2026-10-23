import type { Citation } from '@notebooklm/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CitationPanelProvider } from '../citations/citation-panel-provider';
import { AnswerMarkdown } from './answer-markdown';

const CITATION: Citation = {
  n: 1,
  available: true,
  sourceId: '00000000-0000-4000-8000-000000000001',
  chunkId: '00000000-0000-4000-8000-000000000011',
  page: 3,
  sourceTitle: 'Handbuch.pdf',
  excerpt: 'Die Erde ist rund.',
  content: 'Die Erde ist rund. Das zeigen viele Beobachtungen.',
};

function renderAnswer(content: string, citations: Citation[] | null) {
  return render(
    <CitationPanelProvider>
      <AnswerMarkdown content={content} citations={citations} />
    </CitationPanelProvider>,
  );
}

describe('AnswerMarkdown', () => {
  it('renders Markdown formatting', () => {
    renderAnswer('**Wichtig:**\n\n- erster Punkt\n- zweiter Punkt', []);

    expect(screen.getByText('Wichtig:').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows a script tag in the answer as text instead of executing it', () => {
    const { container } = renderAnswer(
      'Vorher <script>window.hacked = true</script> <img src="x" onerror="alert(1)"> nachher',
      [],
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container).toHaveTextContent('<script>window.hacked = true</script>');
  });

  it('neutralizes javascript links', () => {
    renderAnswer('[Klick mich](javascript:alert(1))', []);

    expect(screen.getByText('Klick mich').closest('a')).not.toHaveAttribute(
      'href',
      expect.stringContaining('javascript'),
    );
  });

  it('does not load images the answer points to', () => {
    const { container } = renderAnswer('![Logo](https://example.com/track.png?data=geheim)', []);

    expect(container.querySelector('img')).toBeNull();
  });

  it('keeps markers as muted text while streaming', () => {
    renderAnswer('Die Erde ist rund [1].', null);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('[1]')).toBeInTheDocument();
  });

  it('turns valid markers into badges and removes invalid ones after the citations event', () => {
    const { container } = renderAnswer('Die Erde ist rund [1]. Erfunden [99].', [CITATION]);

    expect(screen.getByRole('button', { name: 'Zitat 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zitat 99' })).not.toBeInTheDocument();
    expect(container).not.toHaveTextContent('[99]');
    expect(container).toHaveTextContent('Erfunden.');
  });

  it('renders badges inside Markdown formatting', () => {
    renderAnswer('**Die Erde ist rund [1]**', [CITATION]);

    expect(screen.getByRole('button', { name: 'Zitat 1' }).closest('strong')).not.toBeNull();
  });

  it('leaves markers inside code untouched', () => {
    renderAnswer('Index: `array[1]`', [CITATION]);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('array[1]').tagName).toBe('CODE');
  });
});
