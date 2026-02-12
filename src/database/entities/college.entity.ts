import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { City } from './city.entity';
import { CollegeSubscription } from './college-subscription.entity';
import { AiQuery } from './ai-query.entity';
import { CollegePrompt } from './college-prompt.entity';
import { CollegeCompetitor } from './college-competitor.entity';

@Entity('colleges')
export class College {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'college_name', length: 255 })
  collegeName: string;

  @Column({ name: 'city_id', nullable: true })
  cityId?: number;

  @Column({ length: 100, nullable: true })
  city?: string;

  @Column({ length: 100, nullable: true })
  state?: string;

  @Column({ length: 500, nullable: true })
  website?: string;

  @Column({ name: 'nirf_rank', nullable: true })
  nirfRank?: number;

  @Column({ name: 'established_year', nullable: true })
  establishedYear?: number;

  @Column({
    name: 'college_type',
    type: 'enum',
    enum: ['private', 'government', 'deemed', 'autonomous'],
    default: 'private',
  })
  collegeType: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relations
  @ManyToOne(() => City, (city) => city.colleges, { nullable: true })
  @JoinColumn({ name: 'city_id' })
  cityRelation: City;

  @OneToMany(() => CollegeSubscription, (subscription) => subscription.college)
  subscriptions: CollegeSubscription[];

  @OneToMany(() => CollegeCompetitor, (competitor) => competitor.college)
  competitors: CollegeCompetitor[];

  @OneToMany(() => CollegeCompetitor, (competitor) => competitor.competitorCollege)
  competitorOf: CollegeCompetitor[];

  @OneToMany(() => AiQuery, (query) => query.college)
  aiQueries: AiQuery[];

  @OneToMany(() => CollegePrompt, (collegePrompt) => collegePrompt.college)
  prompts: CollegePrompt[];

  // Indexes
  // @Index('idx_city')
  // cityIndex: number;

  // @Index('idx_nirf')
  // nirfIndex: number;

  // @Index('idx_type')
  // typeIndex: string;
}