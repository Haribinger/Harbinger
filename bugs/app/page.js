import { auth } from 'harbinger/auth';
import { ChatPage } from 'harbinger/chat';

export default async function Home() {
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} />;
}
