import React, { useEffect, useRef, useState } from 'react';
import { RefreshCw, ExternalLink, Eye, EyeOff, Monitor, Smartphone } from 'lucide-react';

export default function LivePreview({ files }) {
  const iframeRef = useRef(null);
  const [mobile, setMobile] = useState(false);
  const [visible, setVisible] = useState(true);
  const [key, setKey] = useState(0);

  const buildPreview = () => {
    const htmlFile = files.find(f => f.name === 'index.html' || f.path.endsWith('.html'));
    const cssFile = files.find(f => f.name === 'styles.css' || f.path.endsWith('.css'));
    const jsFile = files.find(f => f.name === 'script.js' && !f.name.endsWith('.json'));

    if (!htmlFile) return '<html><body style="background:#0D1117;color:#94A3B8;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0"><p>No HTML file found. Create an index.html to see a preview.</p></body></html>';

    let html = htmlFile.content;

    // Inject CSS inline if found
    if (cssFile && html.includes('styles.css')) {
      html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        `<style>${cssFile.content}</style>`
      );
    }

    // Inject JS inline if found
    if (jsFile && html.includes('script.js')) {
      html = html.replace(
        '<script src="script.js"></script>',
        `<script>${jsFile.content}</script>`
      );
    }

    return html;
  };

  const refresh = () => setKey(k => k + 1);

  if (!visible) {
    return (
      <div className="h-full flex items-center justify-center bg-void border-t border-border/50">
        <button
          onClick={() => setVisible(true)}
          className="flex items-center gap-2 text-sm text-text-secondary hover:text-accent transition-colors"
        >
          <Eye size={16} /> Show Preview
        </button>
      </div>
    );
  }

  const previewHTML = buildPreview();

  return (
    <div className="flex flex-col h-full bg-void">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50 bg-surface/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-amber-400/60" />
            <div className="w-3 h-3 rounded-full bg-accent/60" />
          </div>
          <div className="ml-2 px-3 py-1 rounded-md bg-panel border border-border text-xs text-text-muted font-mono">
            localhost:preview
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMobile(!mobile)}
            className={`p-1.5 rounded-md transition-colors ${mobile ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="Mobile view"
          >
            <Smartphone size={14} />
          </button>
          <button
            onClick={() => setMobile(false)}
            className={`p-1.5 rounded-md transition-colors ${!mobile ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-secondary hover:bg-panel'}`}
            title="Desktop view"
          >
            <Monitor size={14} />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
          <button onClick={refresh} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-panel transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => setVisible(false)} className="p-1.5 rounded-md text-text-muted hover:text-text-secondary hover:bg-panel transition-colors">
            <EyeOff size={14} />
          </button>
        </div>
      </div>

      {/* Preview frame */}
      <div className="flex-1 overflow-auto bg-[#1a1a2e] flex items-start justify-center py-4">
        <div
          className={`transition-all duration-300 shadow-2xl ${mobile ? 'w-[390px] h-[844px] rounded-2xl overflow-hidden border-2 border-border' : 'w-full h-full'}`}
        >
          <iframe
            key={key}
            ref={iframeRef}
            srcDoc={previewHTML}
            className="w-full h-full"
            style={{ background: 'white' }}
            sandbox="allow-scripts allow-forms"
            title="Live Preview"
          />
        </div>
      </div>
    </div>
  );
}
