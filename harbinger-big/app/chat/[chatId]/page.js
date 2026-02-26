import { auth } from 'harbinger/auth';
import { ChatPage } from 'harbinger/chat';

export default async function ChatRoute({ params }) {
  const { chatId } = params;
  const session = await auth();
  return <ChatPage session={session} needsSetup={false} chatId={chatId} />;
}
