import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Persistence model. It is intentionally separate from the `User` entity so the
 * domain never depends on the database schema.
 */
@Entity('users')
export class UserOrmEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 320, unique: true })
  email: string;

  @Column({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;
}
