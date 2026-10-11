export type Platform = "instagram" | "facebook" | "whatsapp";
export type SenderType = "user" | "bot";
export type ConversationStatus = "active" | "resolved";

export interface Conversation {
  id: string;
  platform: Platform;
  platform_user_id: string;
  username: string | null;
  user_avatar: string | null;
  last_message: string | null;
  last_message_at: string;
  created_at: string;
  updated_at: string;
  status?: ConversationStatus;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  message: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: Conversation;
        Insert: Omit<Conversation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Conversation>;
        Relationships: [];
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Message>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
