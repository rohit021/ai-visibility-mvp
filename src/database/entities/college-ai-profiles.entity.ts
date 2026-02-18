import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
} from 'typeorm';
import { College } from './college.entity';
import { AiQuery } from './ai-query.entity';

// ─────────────────────────────────────────────────────────────────────────────
// TYPED INTERFACES — match the exact JSON shape GPT returns
// ─────────────────────────────────────────────────────────────────────────────

export interface PlacementsData {
  placementRate: string | null;       // "85%"
  averagePackage: string | null;      // "₹5.8 LPA"
  highestPackage: string | null;      // "₹12 LPA"
  topRecruiters: string[] | null;     // ["Wipro", "Infosys", "TCS"]
  batchYear: string | null;           // "2024"
}

export interface FeesData {
  btechAnnual: string | null;         // "₹2.5 Lakh"
  hostel: string | null;              // "₹1.2 Lakh"
  totalProgram: string | null;        // "₹10 Lakh"
}

export interface AccreditationData {
  naacGrade: string | null;           // "A+", "A", "B++"
  nirfRank: string | null;            // "101-150" or "45" — string because ranges exist
  nbaAccredited: boolean | null;
  ugcRecognized: boolean | null;
}

export interface FacultyData {
  totalFaculty: string | null;        // "120"
  phdPercentage: string | null;       // "65%"
  studentFacultyRatio: string | null; // "15:1"
}

export interface InfrastructureData {
  campusSize: string | null;          // "110 acres"
  facilities: string[] | null;        // ["Labs", "Library", "Hostel", "Wi-Fi"]
  hostelAvailable: boolean | null;
}

export interface ReviewsData {
  overallSentiment: 'positive' | 'negative' | 'mixed' | null;
  commonPraises: string[] | null;     // ["campus", "placement support"]
  commonComplaints: string[] | null;  // ["fees", "management"]
  averageRating: string | null;       // "3.8/5"
}

// ─────────────────────────────────────────────────────────────────────────────
// TABLE 1 — college_ai_profiles
//
// PURPOSE:
//   The single source of truth for what AI currently knows about each college.
//   Always holds the LATEST data. 1 row per college. Upserted on every weekly
//   run — old data is overwritten with fresh data.
//
// WHY THIS TABLE EXISTS:
//   Your dashboard, gap analysis, and recommendations engine all need to ask
//   "what does AI know about Amity RIGHT NOW?" — not last week, not last month.
//   This table answers that in a single fast read. No aggregation, no sorting
//   by date, no joining history rows. Just one row per college, always current.
//
// WHO WRITES TO IT:
//   QueryExecutorService.executeDetailQueries() — on every weekly run it does
//   an INSERT ... ON DUPLICATE KEY UPDATE using the unique index on college_id.
//   New run = same row updated, not a new row created.
// ─────────────────────────────────────────────────────────────────────────────

@Entity('college_ai_profiles')
@Unique(['collegeId']) // ← enforces 1 row per college. Upsert target.
export class CollegeAiProfile {
  @PrimaryGeneratedColumn()
  id: number;

  // ── Foreign Keys ──────────────────────────────────────────────────────────

  @Index()
  @Column({ name: 'college_id' })
  collegeId: number;

  // The last query that populated/updated this profile
  @Column({ name: 'last_query_id', nullable: true })
  lastQueryId: number | null;

  // ── Role Flag ─────────────────────────────────────────────────────────────

  // true  → this college is a CLIENT (has a subscription)
  // false → this college is a COMPETITOR (queried on behalf of a client)
  // Used to quickly filter dashboard vs competitor profiles
  @Index()
  @Column({ name: 'is_client_college', default: false })
  isClientCollege: boolean;

  // ── Structured Data (JSON) ────────────────────────────────────────────────
  // JSON because: fields are always read together, never queried individually,
  // and the shape may grow over time without requiring schema migrations.

  @Column({ name: 'placements_data', type: 'json', nullable: true })
  placementsData: PlacementsData | null;

  @Column({ name: 'fees_data', type: 'json', nullable: true })
  feesData: FeesData | null;

  @Column({ name: 'accreditation_data', type: 'json', nullable: true })
  accreditationData: AccreditationData | null;

  @Column({ name: 'faculty_data', type: 'json', nullable: true })
  facultyData: FacultyData | null;

  @Column({ name: 'infrastructure_data', type: 'json', nullable: true })
  infrastructureData: InfrastructureData | null;

  @Column({ name: 'reviews_data', type: 'json', nullable: true })
  reviewsData: ReviewsData | null;

  // ── Sources ───────────────────────────────────────────────────────────────

  // URLs GPT cited when building this profile — updated each run
  @Column({ name: 'sources', type: 'json', nullable: true })
  sources: string[] | null;

  // ── Completeness Metrics (FLAT columns — these ARE queried) ───────────────
  // Rule: JSON for data you display. Flat columns for data you filter/sort/compare.
  //
  // Total possible fields = 20:
  //   placements(5) + fees(3) + accreditation(4) + faculty(3) + infra(3) + reviews(2)

  @Index() // queried often: "show colleges with score < 50"
  @Column({ name: 'data_completeness_score', type: 'tinyint', default: 0 })
  dataCompletenessScore: number;         // 0–100

  @Column({ name: 'fields_populated', type: 'tinyint', default: 0 })
  fieldsPopulated: number;               // e.g. 8

  @Column({ name: 'fields_total', type: 'tinyint', default: 20 })
  fieldsTotal: number;                   // always 20

  // Pre-computed list of missing field names — recommendations engine reads this
  // directly instead of re-parsing all JSON blobs
  // e.g. ["placementRate", "nirfRank", "phdPercentage", "studentFacultyRatio"]
  @Column({ name: 'missing_fields', type: 'json', nullable: true })
  missingFields: string[] | null;

  // ── Run Tracking ──────────────────────────────────────────────────────────

  // When was this profile last refreshed by a weekly run?
  @Index()
  @Column({ name: 'last_run_date', type: 'date', nullable: true })
  lastRunDate: string | null;            // "2025-02-17"

  // How many times has this profile been refreshed in total?
  @Column({ name: 'run_count', default: 0 })
  runCount: number;

  @CreateDateColumn({ name: 'first_seen_at' })
  firstSeenAt: Date;                     // when this college was first profiled

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;                       // auto-updates on every upsert

  // ── Relations ─────────────────────────────────────────────────────────────

  @ManyToOne(() => College, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => AiQuery, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'last_query_id' })
  lastQuery: AiQuery;
}