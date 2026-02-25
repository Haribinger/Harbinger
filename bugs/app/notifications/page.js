import { auth } from 'harbinger/auth';
import { NotificationsPage } from 'harbinger/chat';

export default async function NotificationsRoute() {
  const session = await auth();
  return <NotificationsPage session={session} />;
}
