import React, { useState } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Eye, EyeOff, Copy, Check } from 'lucide-react';

interface SecretInputProps extends Omit<React.ComponentProps<"input">, 'type'> {
  allowCopy?: boolean;
}

export const SecretInput = React.forwardRef<HTMLInputElement, SecretInputProps>(
  ({ className, allowCopy, value, ...props }, ref) => {
    const [showSecret, setShowSecret] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      if (value) {
        navigator.clipboard.writeText(value.toString());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    };

    return (
      <div className="relative w-full">
        <Input
          type={showSecret ? "text" : "password"}
          className={`pr-${allowCopy ? '20' : '10'} ${className || ''}`}
          ref={ref}
          value={value}
          {...props}
        />
        <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-slate-400 hover:text-slate-200"
            onClick={() => setShowSecret(!showSecret)}
            tabIndex={-1}
          >
            {showSecret ? <EyeOff size={14} /> : <Eye size={14} />}
          </Button>
          {allowCopy && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-400 hover:text-slate-200"
              onClick={handleCopy}
              title="Copy to clipboard"
              tabIndex={-1}
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </Button>
          )}
        </div>
      </div>
    );
  }
);
SecretInput.displayName = "SecretInput";
