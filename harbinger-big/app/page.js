import { redirect } from "next/navigation";
import { auth } from "harbinger/auth";
import { ChatPage } from "harbinger/chat";

export default async function Home() {
  const session = await auth();
  if (!session) {
    redirect("/login");
  }
  return <ChatPage session={session} needsSetup={false} />;
}
