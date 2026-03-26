export type EntryStatus = "recorded" | "empty" | "skipped";
export type TopicStatus = "active" | "dormant" | "archived";
export type DailySessionStatus = "in_progress" | "completed";

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

export type TrackedItemPayload = {
  name: string;
  question: string;
  default_text_if_empty: string;
  is_active: boolean;
  sort_order: number;
};

export type Topic = {
  id: number;
  title: string;
  description: string | null;
  status: TopicStatus;
  importance_score: number;
  recency_score: number;
  cadence_hint: string;
  source_question: string | null;
  default_text_if_empty: string | null;
  source_tracked_item_id: number | null;
  last_asked_at: string | null;
  last_updated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TopicPayload = {
  title: string;
  description: string | null;
  status: TopicStatus;
  importance_score: number;
  cadence_hint: string;
  default_text_if_empty: string | null;
};

export type LlmSettings = {
  provider: string;
  api_key: string | null;
  model_name: string | null;
  system_prompt: string | null;
  updated_at: string | null;
};

export type LlmSettingsPayload = {
  provider: string;
  api_key: string | null;
  model_name: string | null;
  system_prompt: string | null;
};

export type LlmTestResponse = {
  ok: boolean;
  provider: string;
  model_name: string | null;
  message: string;
};

export type GeminiModel = {
  name: string;
  display_name: string | null;
  description: string | null;
  supported_generation_methods: string[];
};

export type PlannedTopic = {
  topic_id: number;
  title: string;
  status: TopicStatus;
  question: string;
  rationale: string;
  importance_score: number;
  recency_score: number;
};

export type ConversationMessage = {
  role: "assistant" | "user" | "system";
  content: string;
  topic_id: number | null;
  topic_title: string | null;
};

export type DailyConversationPlan = {
  session_date: string;
  topics: PlannedTopic[];
  archive_candidates: number[];
};

export type DailyConversationStartResponse = {
  session_id: number;
  session_date: string;
  current_topic: PlannedTopic | null;
  assistant_message: string | null;
  total_topics: number;
  covered_topics: number;
  stage: "topic" | "extra_note" | "ready_to_complete";
  transcript: ConversationMessage[];
};

export type DailyConversationMessageResponse = {
  session_id: number;
  current_topic: PlannedTopic | null;
  assistant_message: string | null;
  total_topics: number;
  covered_topics: number;
  stage: "topic" | "extra_note" | "ready_to_complete";
  is_ready_to_complete: boolean;
  transcript: ConversationMessage[];
};

export type TopicUpdate = {
  id: number;
  topic_id: number;
  topic_title_snapshot: string;
  question_text: string;
  raw_answer: string | null;
  follow_up_question: string | null;
  follow_up_answer: string | null;
  final_text: string;
  update_summary: string;
  status: EntryStatus;
  created_at: string;
};

export type DailySession = {
  id: number;
  session_date: string;
  status: DailySessionStatus;
  extra_note: string | null;
  markdown_path: string | null;
  selected_topic_ids: number[];
  archive_candidate_ids: number[];
  transcript: ConversationMessage[];
  updates: TopicUpdate[];
  created_at: string;
  completed_at: string | null;
};

export type DailySessionSummary = {
  id: number;
  session_date: string;
  status: DailySessionStatus;
  selected_topic_ids: number[];
  extra_note: string | null;
  markdown_path: string | null;
  created_at: string;
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
