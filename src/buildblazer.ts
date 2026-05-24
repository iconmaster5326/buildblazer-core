import type { Build } from "./build";
import { Counter } from "./counter";
import type { Entity } from "./entity";
import { Modifier } from "./mod";
import { Statistic } from "./stat";
import type { System, SystemEntity } from "./system";
import { Toggle } from "./toggle";

/** Configuration options to pass to {@link Buildblazer}. */
export interface BuildblazerConfig {
  /** What systems do you want to be able to deserialize? */
  systems?: System[];
}

/**
 * The root class for Buildblazer operations.
 * You must make one of these to access entities and builds from JSON.
 */
export class Buildblazer {
  /** A map of system ID to systems installed in this instance. */
  systems: Record<string, System> = {};
  /** A map of entity type IDs to entities installed in this instance. */
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

  /** Deserialize a subclass of {@link Build} from JSON. */
  buildFromJSON(json: any): Build {
    const t: string = json.system;
    const handler = this.systems[t]?.deserializer;
    if (handler === undefined) {
      throw new Error(`Unknown system '${t}'!`);
    }
    return handler(this, json);
  }

  /** Deserialize a subclass of {@link Entity} from JSON. */
  entityFromJSON(json: any): Entity {
    const t: string = json.type;
    const handler = this.entityTypes[t]?.deserializer;
    if (handler === undefined) {
      throw new Error(`Unknown entity type '${t}'!`);
    }
    return handler(this, json);
  }
}
