import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { Prompt } from './prompt.entity';
import { Recommendation } from './recommendation.entity';

@Entity('prompt_categories')
export class PromptCategory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'category_name', length: 50, unique: true })
  categoryName: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 1.00 })
  weight: number;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Prompt, (prompt) => prompt.category)
  prompts: Prompt[];

  @OneToMany(() => Recommendation, (rec) => rec.category)
  recommendations: Recommendation[];
}
