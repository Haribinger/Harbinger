import { auth } from 'harbinger/auth';
import { SettingsLayout } from 'harbinger/chat';

export default async function Layout({ children }) {
  const session = await auth();
  return <SettingsLayout session={session}>{children}</SettingsLayout>;
}
