import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('prompt_library')
export class PromptLibrary {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'prompt_text', type: 'text' })
  promptText: string;

  @Column({
    type: 'enum',
    enum: [
      'general',
      'program_specific',
      'feature_specific',
      'competitive',
      'student_intent',
    ],
  })
  category: string;

  @Column({ name: 'is_system_prompt', default: true })
  isSystemPrompt: boolean;

  @Column({ name: 'college_id', nullable: true })
  collegeId: number;

  @Column({ name: 'has_placeholders', default: false })
  hasPlaceholders: boolean;

  @Column({ name: 'placeholder_fields', type: 'json', nullable: true })
  placeholderFields: string[];

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
