import * as uuid from "uuid";

import { Entity } from "./entity";
import type { Buildblazer } from "./buildblazer";

/**
 * A single change in a milestone.
 * This is not meant to be overriden by systems; the set of change types are fixed!
 *
 * @see {@link ChangeAdd}, {@link ChangeDel}, {@link ChangeSet}
 */
export abstract class Change {
  /** The UUID of entity that is about to be modified. */
  subject: string;
  /** The internal name of the property to be modified. */
  property: string;

  constructor(subject: string, property: string) {
    this.subject = subject;
    this.property = property;
  }

  /** The unique ID of the change subclass, used for serialization. */
  abstract changeType(): "add" | "set" | "del" | "move";

  /**
   * Apply this change to an entity build built up.
   * @param uuidMap The mapping of UUIDs to Entities.
   * @returns Whether or not this application was successful.
   */
  abstract apply(bb: Buildblazer, uuidMap: Record<string, Entity>): boolean;

  /** Serialize a change from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Change {
    switch (json.type) {
      case "set":
        return new ChangeSet(json.subject, json.property, json.value);
      case "add":
        return new ChangeAdd(
          json.subject,
          json.property,
          json.entity,
          json.index,
        );
      case "del":
        return new ChangeDel(json.subject, json.property, json.entity);
      case "move":
        return new ChangeMove(
          json.subject,
          json.property,
          json.entity,
          json.index,
        );
      default:
        throw new Error(`Unknown change type '${json.type}'!`);
    }
  }

  /** Deserialize a change into JSON. */
  toJSON(): any {
    return {
      type: this.changeType(),
      subject: this.subject,
      property: this.property,
    };
  }
}

/**
 * A {@link Change} that sets a property to a given value.
 */
export class ChangeSet extends Change {
  value: any;

  constructor(subject: string, property: string, value: any) {
    super(subject, property);
    this.value = value;
  }

  changeType(): "set" {
    return "set";
  }

  apply(bb: Buildblazer, uuidMap: Record<string, Entity>): boolean {
    let value = this.value;
    if (typeof value === "object") {
      value = bb.entityFromJSON(value);
    }
    (uuidMap[this.subject] as any)[this.property] = value;
    return true;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      value: this.value,
    };
  }
}

/**
 * A {@link Change} that adds an entity to an entity array.
 */
export class ChangeAdd extends Change {
  entity: any;
  index: number | undefined;

  constructor(subject: string, property: string, entity: any, index?: number) {
    super(subject, property);
    this.entity = entity;
    this.index = index;
  }

  changeType(): "add" {
    return "add";
  }

  apply(bb: Buildblazer, uuidMap: Record<string, Entity>): boolean {
    if (uuidMap[this.entity.id]) return false;
    let a: Entity[] | undefined = (uuidMap[this.subject] as any)[this.property];
    if (a === undefined) {
      a = (uuidMap[this.subject] as any)[this.property] = [];
    }

    const entity = bb.entityFromJSON(this.entity);
    if (this.index === undefined) {
      a.push(entity);
    } else {
      a.splice(Math.min(a.length, Math.max(0, this.index)), 0, entity);
    }

    return true;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      entity: this.entity,
      ...(this.index === undefined ? {} : { index: this.index }),
    };
  }
}

/**
 * A {@link Change} that removes an entity from an entity array, based on UUID.
 * {@link object} must be a string UUID.
 */
export class ChangeDel extends Change {
  entity: string;

  changeType(): "del" {
    return "del";
  }

  constructor(subject: string, property: string, entity: string) {
    super(subject, property);
    this.entity = entity;
  }

  apply(bb: Buildblazer, uuidMap: Record<string, Entity>): boolean {
    const a: Entity[] | undefined = (uuidMap[this.subject] as any)[
      this.property
    ];
    if (a === undefined) return false;
    const i = a.findIndex((e) => e.id === this.entity);
    if (i === -1) return false;
    a.splice(i, 1);
    return true;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      entity: this.entity,
    };
  }
}

/**
 * A {@link Change} that moves an entity around from within an entity array.
 * {@link object} must be the new index.
 */
export class ChangeMove extends Change {
  entity: string;
  index: number;

  constructor(
    subject: string,
    property: string,
    entity: string,
    index: number,
  ) {
    super(subject, property);
    this.entity = entity;
    this.index = index;
  }

  changeType(): "move" {
    return "move";
  }

  apply(bb: Buildblazer, uuidMap: Record<string, Entity>): boolean {
    const a: Entity[] | undefined = (uuidMap[this.subject] as any)[
      this.property
    ];
    if (a === undefined) return false;
    const i = a.findIndex((e) => e.id === this.entity);
    if (i === -1) return false;
    const [val] = a.splice(i, 1);
    if (!val) return false;
    a.splice(this.index, 0, val);
    return true;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      entity: this.entity,
      index: this.index,
    };
  }
}

/** Options for constructing new instance of {@link Milestone}. */
export interface MilestoneOptions {
  /** A human-readable name for the milestone. Usually the number of the level, able to be directly parsed, but can be anything. */
  name?: string;
  /** A set of changes that occur at this milestone. They are applied in order to form the character at a given milestone. */
  changes?: Change[];
}

/**
 * A milestone in a build.
 * Usually milestones occur at each level, but they can be whatever the user/system wishes.
 * These contain changesets, which are built up to construct a character at any given milestone.
 */
export class Milestone {
  /** A human-readable name for the milestone. Usually the number of the level, able to be directly parsed, but can be anything. */
  name: string;
  /** A set of changes that occur at this milestone. They are applied in order to form the character at a given milestone. */
  changes: Change[];

  constructor(options: MilestoneOptions = {}) {
    this.name = options.name ?? "";
    this.changes = [...(options.changes ?? [])];
  }

  /** Deserialize a milestone from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Milestone {
    return new Milestone({
      name: json.name,
      changes: (json.changes ?? []).map((c: any) => Change.fromJSON(bb, c)),
    });
  }

  /** Serialize a milestone to JSON. */
  toJSON(): any {
    return {
      name: this.name,
      changes: this.changes.map((c) => c.toJSON()),
    };
  }

  /** Builds up the given root entity, applying each change in {@link changes} in sequence. */
  apply(bb: Buildblazer, e: Entity): boolean {
    // TODO: log warnings if changes failed
    return this.changes.map((c) => c.apply(bb, e.uuidMap())).every((x) => x);
  }
}

/** Options for constructing new instance of {@link Sheet}. */
export interface SheetOptions {
  /** The name of this sheet. Empty if no name was provided (likely meaning this is the primary sheet). */
  name?: string;
  /** What milestone is this sheet at? The {@link Milestone.(name:instance)|name} of a {@link Milestone}. */
  milestone?: string;
  /** A map of {@link Counter} UUID to its current value. */
  counters?: Record<string, number>;
  /** A map of {@link Toggle} UUID to its current state. */
  toggles?: Record<string, boolean>;
}

/** A character sheet - An instance of a character at a given milestone. Keeps track of counters, conditions, and so on. */
export class Sheet {
  /** The name of this sheet. Empty if no name was provided (likely meaning this is the primary sheet). */
  name: string;
  /** What milestone is this sheet at? The {@link Milestone.(name:instance)|name} of a {@link Milestone}. */
  milestone: string;
  /** A map of {@link Counter} UUID to its current value. */
  counters: Record<string, number>;
  /** A map of {@link Toggle} UUID to its current state. */
  toggles: Record<string, boolean>;

  constructor(options: SheetOptions = {}) {
    this.name = options.name ?? "";
    this.milestone = options.milestone ?? "";
    this.counters = options.counters ?? {};
    this.toggles = options.toggles ?? {};
  }

  /** Deserialialze a sheet from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Sheet {
    return new Sheet(json);
  }

  /** Serialialze a sheet to JSON. */
  toJSON(): any {
    return {
      name: this.name,
      milestone: this.milestone,
      counters: this.counters,
      toggles: this.toggles,
    };
  }
}

/** Options for the constructor of {@link Build}. */
export interface BuildOptions {
  /** The UUID of this build. The entity created by {@link entityAfterMilestone} will have this ID. */
  id?: string;
  /** The human-readable name of this build. The entity created by {@link entityAfterMilestone} will have this name. */
  name?: string;
  /** The version of the system that was loaded from JSON, if this build was deserialized. */
  systemVersion?: number;
  /** Milestones in this build. */
  milestones?: Milestone[];
  /** Sheets in this build. */
  sheets?: Sheet[];
}

/** A build in a given TTRPG system. Tracks all data relevant to a build, and is a top-level import/export of Buildblazer. */
export abstract class Build {
  /** The UUID of this build. The entity created by {@link entityAfterMilestone} will have this ID. */
  id: string;
  /** The human-readable name of this build. The entity created by {@link entityAfterMilestone} will have this name. */
  name: string;
  /** The version of the system that was loaded from JSON, if this build was deserialized. Otherwise, equal to {@link systemVersion}. */
  loadedSystemVersion: number;
  /** Milestones in this build. */
  milestones: Milestone[];
  /** Sheets in this build. */
  sheets: Sheet[];

  /** Get the ID of this build's {@link System}. */
  abstract systemName(): string;
  /** Get the version number of this build's {@link System}. */
  abstract systemVersion(): number;

  constructor(options: BuildOptions = {}) {
    this.id = options.id ?? uuid.v4();
    this.name = options.name ?? "";
    this.loadedSystemVersion = options.systemVersion ?? this.systemVersion();
    this.milestones = [...(options.milestones ?? [])];
    this.sheets = [...(options.sheets ?? [])];
  }

  /** Serialize this build to JSON. */
  toJSON(): any {
    return {
      id: this.id,
      name: this.name,
      system: this.systemName(),
      systemVersion: this.systemVersion(),
      milestones: this.milestones.map((m) => m.toJSON()),
      sheets: this.sheets.map((s) => s.toJSON()),
    };
  }

  /** Create a initial version of this build's resultant entity, without any milestones applied. */
  abstract baseEntity(): Entity;

  /** Get an entity with all relevant milestones before the given one is applied. */
  entityBeforeMilestone(bb: Buildblazer, milestone: Milestone): Entity {
    const e = this.baseEntity();
    for (const m of this.milestones) {
      if (m === milestone) break;
      m.apply(bb, e);
    }
    return e;
  }

  /** Get an entity with all relevant milestones before and up to the given one applied. */
  entityAfterMilestone(bb: Buildblazer, milestone: Milestone): Entity {
    const e = this.baseEntity();
    for (const m of this.milestones) {
      m.apply(bb, e);
      if (m === milestone) break;
    }
    return e;
  }

  /**
   * Get the options you need to pass into this class's constructor to deserialize it from the given JSON.
   * Subclasses of {@link Build} use this in thier {@link System} definitions.
   */
  static optionsFromJSON(bb: Buildblazer, json: any): BuildOptions {
    return {
      id: json.id,
      name: json.name,
      systemVersion: json.systemVersion,
      milestones: (json.milestones ?? []).map((m: any) =>
        Milestone.fromJSON(bb, m),
      ),
      sheets: (json.sheets ?? []).map((s: any) => Sheet.fromJSON(bb, s)),
    };
  }
}
