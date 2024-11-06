import { Entity, PrimaryGeneratedColumn, Column, EntitySchema } from "typeorm";
import "reflect-metadata";

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  Name: string;

  @Column()
  age: number;
}
