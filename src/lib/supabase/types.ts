// 数据库类型定义
export interface Calendar {
  id: string;
  name: string;
  description: string;
  color: string;
  created_by: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  calendar_id: string;
  title: string;
  description: string;
  start_time: string;
  end_time: string;
  all_day: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Member {
  id: string;
  calendar_id: string;
  user_id: string;
  nickname: string;
  role: "owner" | "editor" | "viewer";
  joined_at: string;
}

export interface InviteCode {
  id: string;
  code: string;
  calendar_id: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string;
  created_at: string;
}
