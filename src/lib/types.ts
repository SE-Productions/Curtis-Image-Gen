export type PostFormat = "feed" | "story" | "reel";
export type PostStatus =
  | "idea"
  | "generated"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed";

export type StudioPost = {
  id: string;
  planDate: string;
  title: string;
  topic: string;
  concept: string;
  prompt: string;
  caption: string;
  format: PostFormat;
  status: PostStatus;
  aspectRatio: string;
  director: string;
  mediaUrl: string | null;
  hasMedia: boolean;
  videoUrl: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  instagramPostId: string | null;
  failureReason: string | null;
  createdAt: string;
};

export type StudioSettings = {
  instagramUserId: string;
  instagramUsername: string;
  hasToken: boolean;
  hasNvidiaKey: boolean;
  autoPublish: boolean;
  postHour: number;
  postMinute: number;
  timezone: string;
  format: PostFormat;
  days: number;
};

export type StudioCapabilities = {
  nvidia: boolean;
  grok: boolean;
  imagine: boolean;
  director: "nvidia" | "grok" | "none";
};

export type FaceRecord = {
  id: string;
  createdAt: string;
};
