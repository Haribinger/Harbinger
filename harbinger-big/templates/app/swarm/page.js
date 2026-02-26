import { auth } from 'harbinger/auth';
import { SwarmPage } from 'harbinger/chat';

export default async function SwarmRoute() {
  const session = await auth();
  return <SwarmPage session={session} />;
}
