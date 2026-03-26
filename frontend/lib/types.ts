export type EntryStatus = "recorded" | "empty" | "skipped";

export type TrackedItem = {
  id: number;
  name: string;
  question: string;
  default_text_if_empty: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type QuestionStep = {
  index: number;
  total: number;
  tracked_item: TrackedItem;
};

export type DailyCheckInStartResponse = {
  session_id: string;
  log_date: string;
  total_items: number;
  current_step: QuestionStep | null;
  is_complete: boolean;
};

export type DailyCheckInAnswerResponse = {
  accepted_entry_status: EntryStatus;
  current_step: QuestionStep | null;
  is_complete: boolean;
};

export type SavedEntry = {
  id: number;
  tracked_item_id: number;
  item_name: string;
  raw_answer: string | null;
  final_text: string;
  status: EntryStatus;
  created_at: string;
};

export type DailyLog = {
  id: number;
  log_date: string;
  extra_note: string | null;
  markdown_path: string | null;
  created_at: string;
  entries: SavedEntry[];
};

export type DailyLogSummary = {
  id: number;
  log_date: string;
  extra_note: string | null;
  markdown_path: string | null;
  created_at: string;
  entry_count: number;
};

export type ExportMeta = {
  export_root: string;
  markdown_root: string;
  csv_path: string;
};

export type TrackedItemPayload = {
  name: string;
  question: string;
  default_text_if_empty: string;
  is_active: boolean;
  sort_order: number;
};
