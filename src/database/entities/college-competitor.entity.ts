import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { College } from './college.entity';

@Entity('college_competitors')
export class CollegeCompetitor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({ name: 'competitor_college_id' })
  competitorCollegeId: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'added_at' })
  addedAt: Date;

  // Relations
  @ManyToOne(() => College, (college) => college.competitors)
  @JoinColumn({ name: 'college_id' })
  college: College;

  @ManyToOne(() => College, (college) => college.competitorOf)
  @JoinColumn({ name: 'competitor_college_id' })
  competitorCollege: College;

  // Indexes
  // @Index('idx_college')
  // collegeIndex: number;

  // @Index('idx_competitor')
  // competitorIndex: number;
}