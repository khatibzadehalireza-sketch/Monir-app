export interface Post {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  ameen_count: number;
  comment_count: number;
  i_said_ameen: boolean;
  image_url?: string | null;
}

export interface Comment {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Message {
  role: "user" | "assistant";
  content: string;
  id: string;
  widget?: "prayer" | "qibla" | "post" | "tasbih" | "adhkar" | "prayerTracker";
}
