import * as uuid from "uuid";

import type { EvalContext } from "./expr";
import type { Buildblazer } from "./buildblazer";
import {
  ChangeAdd,
  ChangeDel,
  ChangeMove,
  ChangeSet,
  type Change,
} from "./build";

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
      children: (json.children ?? []).map((c: any) => bb.entityFromJSON(c)),
      instanceOf: json.instanceOf,
    };
  }

  /** Produce the set of changes that would convert the entity array that's in
   * both {@link before} and {@link after}, named {@link prop}. */
  static compareEntityArrayProperty(
    prop: string,
    before: Entity,
    after: Entity,
  ): Change[] {
    const result: Change[] = [];
    const beforeProp: Entity[] = (before as any)[prop];
    const afterProp: Entity[] = (after as any)[prop];

    // calculate index maps
    const beforeChildMap: Map<string, number> = new Map();
    let beforeI = 0;
    for (const child of beforeProp) {
      beforeChildMap.set(child.id, beforeI);
      beforeI++;
    }

    const afterChildMap: Map<string, number> = new Map();
    let afterI = 0;
    for (const child of afterProp) {
      afterChildMap.set(child.id, afterI);
      afterI++;
    }

    // handle deletions
    for (const child of beforeProp) {
      if (!afterChildMap.has(child.id)) {
        result.push(new ChangeDel(before.id, prop, child.id));
      }
    }

    // handle additions
    for (let index = afterProp.length - 1; index >= 0; index--) {
      const afterChild = afterProp[index] as Entity;
      if (!beforeChildMap.has(afterChild.id)) {
        const beforeChild = beforeProp[index];
        let insertIndex: number | undefined = undefined;
        if (beforeChild) {
          insertIndex = index;
        }
        result.push(
          new ChangeAdd(before.id, prop, afterChild.toJSON(), insertIndex),
        );
      }
    }

    // handle movement not caused by add/dels
    const replayed = [...beforeProp];
    for (const change of result) {
      if (change instanceof ChangeAdd) {
        if (change.index === undefined) {
          replayed.push(change.entity);
        } else {
          replayed.splice(change.index, 0, change.entity);
        }
      } else if (change instanceof ChangeDel) {
        replayed.splice(
          replayed.findIndex((e) => e.id === change.entity),
          1,
        );
      } else {
        throw new Error(`Change type not handled! ${change}`);
      }
    }

    let moveIndex = 0;
    while (moveIndex < replayed.length) {
      const afterChild = afterProp[moveIndex] as Entity;
      const replayedChild = replayed[moveIndex] as Entity;

      if (afterChild.id !== replayedChild.id) {
        const destIndex = afterChildMap.get(replayedChild.id) as number;
        result.push(
          new ChangeMove(before.id, prop, replayedChild.id, destIndex),
        );
        const [val] = replayed.splice(moveIndex, 1) as [Entity];
        replayed.splice(destIndex, 0, val);
        moveIndex = 0;
      }
      moveIndex++;
    }

    // recursively handle changes
    for (const beforeChild of beforeProp) {
      const afterChildIndex = afterChildMap.get(beforeChild.id);
      if (afterChildIndex !== undefined) {
        const afterChild = afterProp[afterChildIndex] as Entity;
        result.push(...beforeChild.compare(afterChild));
      }
    }

    // we're done
    return result;
  }

  /** Produce the set of changes that would convert the literal that's in
   * both {@link before} and {@link after}, named {@link prop}. */
  static compareLiteralProperty(
    prop: string,
    before: Entity,
    after: Entity,
  ): Change[] {
    const beforeProp: any = (before as any)[prop];
    const afterProp: any = (after as any)[prop];
    if (beforeProp === afterProp) {
      return [];
    } else {
      return [new ChangeSet(before.id, prop, afterProp)];
    }
  }

  /** Produce the set of changes that would reconstruct the argument given this
   * entity as a base. */
  compare(after: Entity): Change[] {
    return [
      ...Entity.compareLiteralProperty("name", this, after),
      ...Entity.compareLiteralProperty("varName", this, after),
      ...Entity.compareEntityArrayProperty("children", this, after),
    ];
  }

  descendant(id: string): Entity | undefined {
    for (const child of this.children) {
      const result = child.descendantOrSelf(id);
      if (result) return result;
    }
  }

  descendantOrSelf(id: string): Entity | undefined {
    if (this.id === id) return this;
    return this.descendant(id);
  }
}
