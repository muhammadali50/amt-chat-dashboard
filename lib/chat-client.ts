import type { Conversation, Message } from "@/types/database";
async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 401 || response.status === 503) { window.location.assign("/login"); throw new Error("Sign in required"); }
  if (!response.ok) throw new Error("Request failed");
  return response.json();
}
export const getMessages = (id: string) => read<Message[]>(`/api/conversations/${encodeURIComponent(id)}/messages`);
export function subscribeToConversations(onChange: (conversations: Conversation[]) => void) {
  const timer = setInterval(() => { void read<Conversation[]>("/api/conversations").then(onChange).catch(() => undefined); }, 10000);
  return () => clearInterval(timer);
}
