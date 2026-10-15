import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { ChatThread } from '@/components/chat/chat-thread';
import { findPerson } from '@/lib/sample-data';

export const dynamic = 'force-dynamic';

export default async function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const person = findPerson(id);
  if (!person) notFound();

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col md:h-screen">
      <div className="border-b border-border px-4 py-2 md:hidden">
        <Link href="/inbox" className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Inbox
        </Link>
      </div>
      <div className="min-h-0 flex-1">
        <ChatThread person={person} />
      </div>
    </div>
  );
}
