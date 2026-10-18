'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ProfileFormProps {
  initial: {
    displayName: string;
    age: number | null;
    location: string | null;
    bio: string | null;
    interests: string | null;
  };
}

export function ProfileForm({ initial }: ProfileFormProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    const form = new FormData(event.currentTarget);
    const body = {
      displayName: String(form.get('displayName') ?? ''),
      age: form.get('age') ? Number(form.get('age')) : undefined,
      location: String(form.get('location') ?? '') || undefined,
      bio: String(form.get('bio') ?? '') || undefined,
      interests: String(form.get('interests') ?? '') || undefined
    };

    try {
      const response = await fetch('/api/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus({ kind: 'error', text: data.error ?? 'Could not save your profile.' });
        return;
      }
      setStatus({ kind: 'ok', text: 'Profile saved.' });
      router.refresh();
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          name="displayName"
          defaultValue={initial.displayName}
          required
          minLength={2}
          maxLength={80}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="age">Age</Label>
          <Input id="age" name="age" type="number" min={18} max={120} defaultValue={initial.age ?? ''} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            name="location"
            defaultValue={initial.location ?? ''}
            maxLength={120}
            placeholder="Nairobi, KE"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="interests">Interests</Label>
        <Input
          id="interests"
          name="interests"
          defaultValue={initial.interests ?? ''}
          maxLength={200}
          placeholder="Music, hiking, startups"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">Bio</Label>
        <textarea
          id="bio"
          name="bio"
          defaultValue={initial.bio ?? ''}
          maxLength={500}
          rows={4}
          className="flex w-full rounded-md border border-input bg-card px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Tell matches a little about yourself."
        />
      </div>

      {status ? (
        <p className={`text-sm ${status.kind === 'error' ? 'text-destructive' : 'text-[#5f8a1f]'}`}>{status.text}</p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </Button>
    </form>
  );
}
