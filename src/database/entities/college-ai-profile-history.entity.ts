import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { College } from './college.entity';
import { AiQuery } from './ai-query.entity';

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 2 — college_ai_profile_history
//
// PURPOSE:
//   A lightweight, append-only record of every weekly run.
//   Stores ONLY metrics (scores, counts, gaps) — NOT the full JSON data.
//   The full JSON data lives in college_ai_profiles (Table 1) and gets
//   overwritten each run. This table preserves the trend over time.
//
// WHY THIS TABLE EXISTS:
//   Without this table, you can never answer:
//     - "Did Amity's AI profile improve this month?"
//     - "When did BML Munjal's completeness jump from 60% to 85%?"
//     - "Is our client closing the gap on competitors over time?"
//   These are the questions that PROVE your product is working.
//   A client who sees their score go from 40% → 65% → 80% over 3 months
//   will renew their subscription. This table is your retention feature.
//
// WHY NOT STORE JSON HERE TOO:
//   The JSON blobs (placements, fees etc.) almost never change week to week.
//   Storing them 52 times a year per college is pure waste — same data,
//   repeated endlessly. The latest JSON is always in college_ai_profiles.
//   This table only stores what CHANGES: the scores and the gap metrics.
//
// WHO WRITES TO IT:
//   QueryExecutorService.executeDetailQueries() — after updating Table 1,
//   it ALSO inserts a new row here (append-only, never updated).
//   One row per college per run_date.
// ─────────────────────────────────────────────────────────────────────────────

@Entity('college_ai_profile_history')
@Unique(['collegeId', 'runDate']) // one snapshot per college per week
export class CollegeAiProfileHistory {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Foreign Keys ──────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  // The client college that OWNS this run.
  // When snapshotting a competitor, this tells you which client triggered it.
  // Lets you query: "all snapshots from Amity's weekly runs" including
  // competitor snapshots taken on Amity's behalf.
  @Index()
  @Column({ name: 'client_college_id' })
  clientCollegeId: number;

  @Column({ name: 'query_id', nullable: true })
  queryId: number | null;

  // ── Role ──────────────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'is_client_college', default: false })
  isClientCollege: boolean;

  // ── The Run Date ──────────────────────────────────────────────────────────

  // The week this snapshot was taken. Used for trend charts on the dashboard.
  // Stored as DATE not TIMESTAMP so grouping by week is clean.
  @Index()
  @Column({ name: 'run_date', type: 'date' })
  runDate: string;              // "2025-02-17"

  // ── Completeness Metrics ──────────────────────────────────────────────────
  // These are the only fields that change week-to-week and matter for trends.

  @Column({ name: 'completeness_score', type: 'tinyint', default: 0 })
  completenessScore: number;    // 0–100 this week

  @Column({ name: 'fields_populated', type: 'tinyint', default: 0 })
  fieldsPopulated: number;      // e.g. 8 out of 20

  // How many fields improved since the PREVIOUS run?
  // Null on first run. Positive = got better, Negative = something went missing.
  @Column({ name: 'score_change', type: 'tinyint', nullable: true })
  scoreChange: number | null;   // e.g. +3 means 3 more fields populated vs last week

  // Which fields were missing THIS week — snapshot of the gap at this point in time
  @Column({ name: 'missing_fields', type: 'json', nullable: true })
  missingFields: string[] | null;

  // Which fields were NEWLY populated since last run — the "wins" to show the client
  // e.g. ["nirfRank", "phdPercentage"] — "AI now knows your NIRF rank!"
  @Column({ name: 'newly_populated_fields', type: 'json', nullable: true })
  newlyPopulatedFields: string[] | null;

  // ── Gap vs Best Competitor ─────────────────────────────────────────────────
  // Snapshot of how far behind (or ahead) this college was vs the top competitor
  // at the time of this run. This is the number that should trend toward 0.

  // Completeness score of the best competitor in this run
  @Column({ name: 'best_competitor_score', type: 'tinyint', nullable: true })
  bestCompetitorScore: number | null;   // e.g. 75

  // client score - best competitor score (negative = behind, positive = ahead)
  @Column({ name: 'gap_vs_best_competitor', type: 'tinyint', nullable: true })
  gapVsBestCompetitor: number | null;   // e.g. -35 means competitor is 35 points ahead

  // Name of the best competitor this week (for display in trend charts)
  @Column({ name: 'best_competitor_name', length: 255, nullable: true })
  bestCompetitorName: string | null;    // "BML Munjal University"

  // ── Run Cost ──────────────────────────────────────────────────────────────

  // Cost of the API call that generated this snapshot — for internal billing tracking
  @Column({ name: 'query_cost', type: 'decimal', precision: 10, scale: 7, nullable: true })
  queryCost: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // ── Relations ─────────────────────────────────────────────────────────────

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_college_id' })
  clientCollege: College;

  @ManyToOne(() => AiQuery, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'query_id' })
  query: AiQuery;
}