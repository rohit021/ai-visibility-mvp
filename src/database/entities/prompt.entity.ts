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
import { PromptCategory } from './prompt-category.entity';
// import { CollegeSubscription } from './college-subscription.entity';
import { AiQuery } from './ai-query.entity';

@Entity('prompts')
export class Prompt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'prompt_template', type: 'text' })
  promptTemplate: string;

  @Index()
  @Column({ name: 'category_id' })
  categoryId: number;

  @Index()
  @Column({ name: 'is_system_prompt', default: true })
  isSystemPrompt: boolean;

  @Column({
    type: 'enum',
    enum: ['visibility', 'comparison', 'detail'],
    name: 'query_layer',
    default: 'visibility',
  })
  query_layer: 'visibility' | 'comparison' | 'detail';


  @Column({ type: 'json', nullable: true })
  placeholders: string[];

  @Index()
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  // Relationships
  @ManyToOne(() => PromptCategory, (category) => category.prompts)
  @JoinColumn({ name: 'category_id' })
  category: PromptCategory;


  @OneToMany(() => AiQuery, (query) => query.prompt)
  aiQueries: AiQuery[];
}
