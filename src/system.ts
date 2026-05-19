import type { Build } from "./build";
import type { Buildblazer } from "./buildblazer";
import type { Entity } from "./entity";

/** Information for a subclass of {@link Entity} for {@link Buildblazer}. */
export interface SystemEntity {
  /** The ID of this entity type. A short identifier. */
  id: string;
  /** A function that can be invoked to deserialize an entity of the given type. */
  deserializer: (bb: Buildblazer, json: any) => Entity;
}

/** Information for a subclass of {@link Build} for {@link Buildblazer}. */
export interface System {
  /** The ID of this system. A short identifier. */
  id: string;
  /** A human-readable name for this system. */
  name: string;
  /** THe current version number of this system. */
  version: number;
  /** A function that can be invoked to deserialize a build of the given type. */
  deserializer: (bb: Buildblazer, json: any) => Build;
  /** Any entity types this system adds. */
  entities: SystemEntity[];
}
