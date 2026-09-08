import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Moon, Sun, LogOut, KeyRound, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { getApiUrl, saveApiUrl, DEFAULT_API_URL } from '@/lib/api';

export function Settings() {
  const { username, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [apiUrl, setApiUrl] = useState(getApiUrl());
  const [saved, setSaved] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-5 py-8 pb-20 space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Account, appearance, and connection settings.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Account</CardTitle>
          <CardDescription>Board, Resume Tailor, Cover Letter, and Interview Prep all use this account.</CardDescription>
        </CardHeader>
        <CardContent>
          {username ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <span className="text-xs font-bold uppercase">{username.slice(0, 2)}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{username}</p>
                  <p className="text-xs text-muted-foreground">Logged in</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={logout} className="gap-1.5">
                <LogOut className="h-3.5 w-3.5" /> Log out
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">You're not logged in.</p>
              <Button asChild size="sm">
                <Link to="/login">Log in / Register</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5"><Sun className="h-3.5 w-3.5" /> Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <p className="text-sm text-foreground">Theme</p>
            <Button variant="outline" size="sm" onClick={toggle} className="gap-1.5 w-28 justify-center">
              {theme === 'dark' ? <><Sun className="h-3.5 w-3.5" /> Light</> : <><Moon className="h-3.5 w-3.5" /> Dark</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5"><Server className="h-3.5 w-3.5" /> Backend connection</CardTitle>
          <CardDescription>Only change this if you're running your own backend deployment.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>API URL</Label>
          <div className="flex gap-2">
            <Input
              value={apiUrl}
              onChange={(e) => { setApiUrl(e.target.value); setSaved(false); }}
              placeholder={DEFAULT_API_URL}
              className="font-mono text-xs"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => { saveApiUrl(apiUrl || DEFAULT_API_URL); setSaved(true); }}
            >
              {saved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> AI features</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Resume Tailor, Cover Letter, and Interview Prep run on the shared backend's own Gemini key —
            no API key needed from you. Just log in above.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
