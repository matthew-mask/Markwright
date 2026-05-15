import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { useEffect, useState } from 'react';

// Lazy-load mermaid: ~500 KB. Only paid for when the user opens a doc with a mermaid block.
let mermaidPromise: Promise<typeof import('mermaid').default> | null = null;
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      mod.default.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'loose',
        fontFamily: 'inherit'
      });
      return mod.default;
    });
  }
  return mermaidPromise;
}

let renderCounter = 0;

export function MermaidCodeBlockView({ node }: NodeViewProps): JSX.Element {
  const lang = (node.attrs.language as string | null | undefined) ?? null;
  const isMermaid = lang === 'mermaid';
  const source = node.textContent;
  const [mode, setMode] = useState<'preview' | 'source'>('preview');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!isMermaid || mode !== 'preview') return;
    const trimmed = source.trim();
    if (!trimmed) {
      setSvg('');
      setError('');
      return;
    }
    let cancelled = false;
    void loadMermaid().then(async (mermaid) => {
      const id = `mw-mermaid-${++renderCounter}`;
      try {
        const result = await mermaid.render(id, trimmed);
        if (!cancelled) {
          setSvg(result.svg);
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setSvg('');
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [source, isMermaid, mode]);

  // Non-mermaid code blocks: render plain.
  if (!isMermaid) {
    return (
      <NodeViewWrapper>
        <pre className="mw-code-block">
          <NodeViewContent as="code" />
        </pre>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper className="mw-mermaid-block">
      {mode === 'preview' && (
        <div className="mw-mermaid-preview" contentEditable={false}>
          <div className="mw-mermaid-header">
            <span className="mw-mermaid-label">Mermaid</span>
            <button
              type="button"
              className="mw-mermaid-toggle"
              onClick={() => setMode('source')}
            >
              Edit source
            </button>
          </div>
          {error ? (
            <pre className="mw-mermaid-error">{error}</pre>
          ) : svg ? (
            <div className="mw-mermaid-svg" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="mw-mermaid-empty">
              {source.trim() ? 'Rendering…' : 'Empty diagram. Click "Edit source" to add content.'}
            </div>
          )}
        </div>
      )}

      {/* NodeViewContent must stay mounted so Tiptap keeps the text in sync; we hide it in preview mode via CSS. */}
      <div className="mw-mermaid-source" style={{ display: mode === 'source' ? 'block' : 'none' }}>
        <div className="mw-mermaid-header" contentEditable={false}>
          <span className="mw-mermaid-label">Mermaid source</span>
          <button
            type="button"
            className="mw-mermaid-toggle"
            onClick={() => setMode('preview')}
          >
            Show diagram
          </button>
        </div>
        <pre className="mw-code-block">
          <NodeViewContent as="code" />
        </pre>
      </div>
    </NodeViewWrapper>
  );
}
