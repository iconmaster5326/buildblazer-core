import * as uuid from "uuid";

import type { EvalContext } from "./expr";
import type { Buildblazer } from "./buildblazer";

/** A reference to an entity in a database. */
export interface DatabaseReference {
  database: string;
  entry: string;
  version?: number;
}

/** Options for the constructor of {@link Entity}. */
export interface EntityOptions {
  /** The UUID of this entity. Assigned a new UUID if not specified. */
  id?: string;
  /** The human-readable name of this entity. */
  name?: string;
  /** An identifier usable for access by expressions. */
  varName?: string;
  /** Any child entities this entity contains. */
  children?: Entity[];
  /** Was this entity copied from a database? If so, which? */
  instanceOf?: DatabaseReference;
}

/**
 * The base class for Buildblazer entities.
 * Entities have a unique ID, can be refered to by expression variables, can be built up in builds, and sit in a heirchary of entities modifiable by the user.
 */
export abstract class Entity {
  /** The UUID of this entity. */
  id: string;
  /** The human-readable name of this entity. The empty string if nameless. */
  name: string;
  /** An identifier usable for access by expressions. The empty string if you can't access this via expressions. */
  varName: string;
  /** Any child entities this entity contains. */
  children: Entity[];
  /** Was this entity copied from a database? If so, which? */
  instanceOf: DatabaseReference | undefined;

  constructor(options: EntityOptions = {}) {
    this.id = options.id ?? uuid.v4();
    this.name = options.name ?? "";
    this.varName = options.varName ?? "";
    this.children = Array.from(options.children ?? []);
    this.instanceOf = options.instanceOf;
  }

  /** Retuens the entity type ID of this entity. Used for JSON serialization/deserialization. */
  abstract entityType(): string;

  /** Serialize this entity to JSON. */
  toJSON(): any {
    return {
      id: this.id,
      type: this.entityType(),
      ...(this.name ? { name: this.name } : {}),
      ...(this.varName ? { varName: this.varName } : {}),
      ...(this.children
        ? { children: this.children.map((x) => x.toJSON()) }
        : {}),
      ...(this.instanceOf ? { instanceOf: this.instanceOf } : {}),
    };
  }

  /** Get a mapping of UUID to entity, of this entiy and all child entities, recursively. */
  uuidMap(map?: Record<string, Entity>): Record<string, Entity> {
    if (map === undefined) {
      map = {};
    } else if (map[this.id]) {
      throw new Error("Two entities have the same UUID!");
    }
    map[this.id] = this;
    this.children.forEach((child) => {
      child.uuidMap(map);
    });
    return map;
  }

  /** The context to evaluate expressions in if they're local to this entity. */
  evalContext(): EvalContext {
    return {
      currentEntity: this,
      rootEntity: this,
      uuidMap: this.uuidMap(),
    };
  }

  /**
   * Get the options you need to pass into this class's constructor to deserialize it from the given JSON.
   * Subclasses of {@link Entity} use this in thier {@link SystemEntity} definitions.
   */
  static optionsFromJSON(bb: Buildblazer, json: any): EntityOptions {
    return {
      id: json.id,
      name: json.name,
      varName: json.varName,
      children: (json.children ?? []).map(bb.entityFromJSON),
      instanceOf: json.instanceOf,
    };
  }
}
