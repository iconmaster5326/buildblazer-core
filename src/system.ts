import type { Build } from "./build";
import type { Entity } from "./entity";

export interface SystemEntity {
  id: string;
  deserializer: (json: any) => Entity;
}

export interface System {
  id: string;
  name: string;
  version: number;
  deserializer: (json: any) => Build;
  entities: SystemEntity[];
}
