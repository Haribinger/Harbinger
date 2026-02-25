import { auth } from 'harbinger/auth';
import { ChatsPage } from 'harbinger/chat';

export default async function ChatsRoute() {
  const session = await auth();
  return <ChatsPage session={session} />;
}
