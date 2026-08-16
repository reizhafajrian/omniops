import React, { useState } from 'react';
import { getStoredToken, setStoredToken } from '../api/client';;;
import { Key, Shield, Check, Eye, EyeOff, Copy, ClipboardPaste } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSaved }) => {
  const [token, setToken] = useState(getStoredToken());
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setStoredToken(token.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSaved();
      onClose();
    }, 600);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setToken(text);
    } catch {
      // User may have denied clipboard permission — fail silently
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary shrink-0">
              <Key size={18} aria-hidden="true" />
            </div>
            <div>
              <DialogTitle>Engine Access Token</DialogTitle>
              <DialogDescription>Bearer token for Axum backend authentication</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="token-input">GITOPS_TOKEN Secret</Label>
            <div className="relative">
              <Input
                id="token-input"
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="e.g. change_me_to_a_long_random_secret"
                className="pr-28 font-mono text-xs"
                autoComplete="off"
                spellCheck={false}
              />
              <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowToken(!showToken)}
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                  className="h-7 w-7 p-0"
                >
                  {showToken ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  aria-label="Copy token to clipboard"
                  className="h-7 w-7 p-0"
                >
                  {copied
                    ? <Check size={14} className="text-emerald-400" aria-hidden="true" />
                    : <Copy size={14} aria-hidden="true" />
                  }
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  aria-label="Paste token from clipboard"
                  className="h-7 w-7 p-0"
                >
                  <ClipboardPaste size={14} aria-hidden="true" />
                </Button>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Stored in browser LocalStorage and attached to every API and WebSocket request.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {savedSuccess
                ? <><Check size={14} aria-hidden="true" /> Saved!</>
                : <><Shield size={14} aria-hidden="true" /> Save Token</>
              }
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
