import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { College } from './college.entity';

@Entity('competitors')
export class Competitor {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_id' })
  collegeId: number;

  @Column({ name: 'competitor_college_name' })
  competitorCollegeName: string;

  @Column({ name: 'competitor_city', nullable: true })
  competitorCity: string;

  @Column({ name: 'competitor_nirf_rank', nullable: true })
  competitorNirfRank: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => College, (college) => college.competitors)
  @JoinColumn({ name: 'college_id' })
  college: College;
}
