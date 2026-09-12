export type EventKind = "feature" | "release";

export type ProjectId =
  | "emr"
  | "homework-central"
  | "flinstone"
  | "keyquorum"
  | "qpu"
  | "flinstone-os"
  | "portfolio";

export type TimelineFilter = "all" | ProjectId;

export interface LanguageShare {
  name: string;
  pct: number;
  color: string;
}

export interface TimelineEvent {
  date: string;
  kind: EventKind;
  project: ProjectId;
  title: string;
  detail: string;
  href?: string;
}

export interface PortfolioData {
  compiled: string;
  source: string;
  projects: Record<ProjectId, string>;
  projectOrder: readonly ProjectId[];
  languages: Partial<Record<ProjectId, readonly LanguageShare[]>>;
  events: readonly TimelineEvent[];
}
