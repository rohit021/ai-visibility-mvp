import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  OneToMany,
} from 'typeorm';
import { AiQuery } from './ai-query.entity';

@Entity('ai_engines')
export class AiEngine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'engine_name', length: 50, unique: true })
  engineName: string;

  @Column({ name: 'display_name', length: 100, nullable: true })
  displayName: string;

  @Column({ name: 'api_endpoint', length: 500, nullable: true })
  apiEndpoint: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => AiQuery, (query) => query.aiEngine)
  queries: AiQuery[];
}
