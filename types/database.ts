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

export type WebsiteVisitor = {
  id: string;
  visitor_key: string;
  name: string | null;
  email: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  first_source: string;
  last_source: string;
  first_seen: string | null;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
};

export type WebsitePageHistory = {
  id: string;
  visitor_id: string;
  page_visit_key: string | null;
  page_path: string;
  entered_at: string;
  duration_seconds: number;
};

export interface Database {
  public: {
    Tables: {
      conversations: {
        Row: Conversation & Record<string, unknown>;
        Insert: (Omit<Conversation, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        }) & Record<string, unknown>;
        Update: Partial<Conversation> & Record<string, unknown>;
        Relationships: [];
      };
      messages: {
        Row: Message & Record<string, unknown>;
        Insert: (Omit<Message, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        }) & Record<string, unknown>;
        Update: Partial<Message> & Record<string, unknown>;
        Relationships: [];
      };
      website_visitors: {
        Row: WebsiteVisitor;
        Insert: Omit<WebsiteVisitor, "id" | "created_at" | "updated_at"> & {
          id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<WebsiteVisitor>;
        Relationships: [];
      };
      website_page_history: {
        Row: WebsitePageHistory;
        Insert: Omit<WebsitePageHistory, "id" | "entered_at" | "duration_seconds" | "page_visit_key"> & {
          id?: string;
          page_visit_key?: string | null;
          entered_at?: string;
          duration_seconds?: number;
        };
        Update: Partial<WebsitePageHistory>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
