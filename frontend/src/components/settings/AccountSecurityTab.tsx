import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, Save, LogOut } from 'lucide-react';
import { AppSettings } from '@/types/system';
import { SecretInput } from '@/components/ui/secret-input';
import { toast } from 'sonner';

interface AccountSecurityTabProps {
  settings?: AppSettings;
  onSave: (settings: Partial<AppSettings>) => void;
  onLogout?: () => void;
  isSaving: boolean;
}

export const AccountSecurityTab: React.FC<AccountSecurityTabProps> = ({ settings, onSave, onLogout, isSaving }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    if (settings?.admin_password) {
      setPassword(settings.admin_password);
    }
  }, [settings]);

  const handleSave = () => {
    if (password && password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    onSave({ admin_password: password });
  };

  return (
    <Card className="border-slate-800 bg-dark-900 shadow-xl overflow-hidden group">
      <CardHeader className="border-b border-slate-800/50 bg-slate-900/50 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-500/10 rounded-lg text-brand-400">
            <Shield size={20} />
          </div>
          <div>
            <CardTitle className="text-lg text-slate-200">Account Security</CardTitle>
            <CardDescription className="text-slate-400">Manage your administrative password and access.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <SecretInput
              id="password"
              placeholder="Enter new admin password"
              value={password}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
              className="bg-dark-800 border-slate-700 focus:border-brand-500"
            />
            <p className="text-xs text-slate-500">
              Update the password used to log into the OmniOps platform.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm_password">Confirm New Password</Label>
            <SecretInput
              id="confirm_password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
              className="bg-dark-800 border-slate-700 focus:border-brand-500"
            />
          </div>
        </div>
      </CardContent>
      <CardFooter className="bg-slate-900/50 border-t border-slate-800/50 px-6 py-4 flex justify-between">
        <Button variant="outline" onClick={onLogout} className="border-slate-700 hover:bg-slate-800">
          <LogOut size={16} className="mr-2" />
          Log Out
        </Button>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-brand-600 hover:bg-brand-700 text-white"
        >
          {isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
          Save Password
        </Button>
      </CardFooter>
    </Card>
  );
};
