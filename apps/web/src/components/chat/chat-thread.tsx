'use client';

import { useState } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SampleMessage, SamplePerson } from '@/lib/sample-data';

export function ChatThread({ person }: { person: SamplePerson }) {
  const [messages, setMessages] = useState<SampleMessage[]>(person.messages);
  const [draft, setDraft] = useState('');

  function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    const time = new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
    setMessages((current) => [...current, { from: 'you', text, time }]);
    setDraft('');
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-foreground"
          style={{ background: person.color }}
        >
          {person.initials}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{person.name}</p>
          <p className="truncate text-xs text-muted-foreground">{person.topic}</p>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-5">
        {messages.map((message, index) => (
          <div key={index} className={cn('flex', message.from === 'you' ? 'justify-end' : 'justify-start')}>
            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-3.5 py-2 text-sm',
                message.from === 'you'
                  ? 'rounded-br-sm bg-primary text-primary-foreground'
                  : 'rounded-bl-sm bg-muted text-foreground'
              )}
            >
              <p>{message.text}</p>
              <p
                className={cn(
                  'mt-1 text-right text-[10px]',
                  message.from === 'you' ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}
              >
                {message.time}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border px-4 py-3">
        <form onSubmit={send} className="flex items-center gap-2">
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Type a message…"
            aria-label="Message"
          />
          <Button type="submit" size="icon" aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="mt-2 text-xs text-muted-foreground">
          Sample conversation. Earnings are credited only from completed, eligible chats.
        </p>
      </div>
    </div>
  );
}
