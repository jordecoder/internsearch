import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyButton({ getText }: { getText: () => string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(getText()).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="h-3.5 w-3.5 text-sage-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
