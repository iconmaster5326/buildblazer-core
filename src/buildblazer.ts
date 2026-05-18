import type { Build } from "./build";
import { Counter } from "./counter";
import type { Entity } from "./entity";
import { Modifier } from "./mod";
import { Statistic } from "./stat";
import type { System, SystemEntity } from "./system";
import { Toggle } from "./toggle";

export interface BuildblazerConfig {
  systems?: System[];
}

export class Buildblazer {
  systems: Record<string, System> = {};
  entityTypes: Record<string, SystemEntity> = {};

  constructor(config: BuildblazerConfig = {}) {
    // add default entities
    this.entityTypes[Counter.ETYPE.id] = Counter.ETYPE;
    this.entityTypes[Modifier.ETYPE.id] = Modifier.ETYPE;
    this.entityTypes[Statistic.ETYPE.id] = Statistic.ETYPE;
    this.entityTypes[Toggle.ETYPE.id] = Toggle.ETYPE;

    // add any systems
    if (config.systems) {
      for (const system of config.systems) {
        this.systems[system.id] = system;
        for (const eType of system.entities) {
          this.entityTypes[eType.id] = eType;
        }
      }
    }
  }

  buildFromJSON(json: any): Build {
    const t: string = json["system"];
    const handler = this.systems[t]?.deserializer;
    if (handler === undefined) {
      throw new Error(`Unknown system '${t}'!`);
    }
    return handler(json);
  }

  entityFromJSON(json: any): Entity {
    const t: string = json["type"];
    const handler = this.entityTypes[t]?.deserializer;
    if (handler === undefined) {
      throw new Error(`Unknown entity type '${t}'!`);
    }
    return handler(json);
  }
}
