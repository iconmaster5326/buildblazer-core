import * as uuid from "uuid";

import { Entity } from "./entity";

export abstract class Change {
  subject: string;
  property: string;
  object: any;

  constructor(subject: string, property: string, object: any) {
    this.subject = subject;
    this.property = property;
    this.object = object;
  }

  abstract changeType(): string;
  abstract apply(uuidMap: Record<string, Entity>): boolean;

  static fromJSON(json: any): Change {
    switch (json["type"]) {
      case "set":
        return new ChangeSet(json["subject"], json["property"], json["object"]);
      case "add":
        return new ChangeAdd(json["subject"], json["property"], json["object"]);
      case "del":
        return new ChangeDel(json["subject"], json["property"], json["object"]);
      default:
        throw new Error(`Unknown change type '${json["type"]}'!`);
    }
  }

  toJSON(): object {
    return {
      type: this.changeType(),
      subject: this.subject,
      property: this.property,
      object: this.object,
    };
  }
}

export class ChangeSet extends Change {
  changeType(): string {
    return "set";
  }

  apply(uuidMap: Record<string, Entity>): boolean {
    (uuidMap[this.subject] as any)[this.property] = this.object;
    return true;
  }
}

export class ChangeAdd extends Change {
  changeType(): string {
    return "add";
  }

  apply(uuidMap: Record<string, Entity>): boolean {
    if (uuidMap[(this.object as Entity).id]) {
      return false;
    }
    let a: Entity[] | undefined = (uuidMap[this.subject] as any)[this.property];
    if (a === undefined) {
      a = (uuidMap[this.subject] as any)[this.property] = [];
    }
    a.push(this.object);
    return true;
  }
}

export class ChangeDel extends Change {
  changeType(): string {
    return "del";
  }

  apply(uuidMap: Record<string, Entity>): boolean {
    const a: Entity[] | undefined = (uuidMap[this.subject] as any)[
      this.property
    ];
    if (a === undefined) {
      return false;
    }
    const i = a.findIndex((e) => e.id === (this.object as string));
    if (i === -1) {
      return false;
    }
    a.splice(i, 1);
    return true;
  }
}

export class Milestone {
  name: string;
  changes: Change[];

  constructor(
    options: {
      name?: string;
      changes?: Change[];
    } = {},
  ) {
    this.name = options.name ?? "";
    this.changes = [...(options.changes ?? [])];
  }

  static fromJSON(json: any): Milestone {
    return new Milestone({
      ...json,
      changes: json["changes"].map(Change.fromJSON),
    });
  }

  toJSON(): object {
    return {
      name: this.name,
      changes: this.changes.map((c) => c.toJSON()),
    };
  }

  apply(e: Entity): boolean {
    // TODO: log warnings if changes failed
    return this.changes.map((c) => c.apply(e.uuidMap())).every((x) => x);
  }
}

export class Sheet {
  name: string;
  milestone: string;
  counters: Record<string, number>;
  toggles: Record<string, boolean>;

  constructor(
    options: {
      name?: string;
      milestone?: string;
      counters?: Record<string, number>;
      toggles?: Record<string, boolean>;
    } = {},
  ) {
    this.name = options.name ?? "";
    this.milestone = options.milestone ?? "";
    this.counters = options.counters ?? {};
    this.toggles = options.toggles ?? {};
  }

  static fromJSON(json: any): Sheet {
    return new Sheet(json);
  }

  toJSON(): object {
    return {
      name: this.name,
      milestone: this.milestone,
      counters: this.counters,
      toggles: this.toggles,
    };
  }
}

export abstract class Build {
  id: string;
  name: string;
  loadedSystemVersion: number;
  milestones: Milestone[];
  sheets: Sheet[];

  abstract systemName(): string;
  abstract systemVersion(): number;

  constructor(
    options: {
      id?: string;
      name?: string;
      loadedSystemVersion?: number;
      milestones?: Milestone[];
      sheets?: Sheet[];
    } = {},
  ) {
    this.id = options.id ?? uuid.v4();
    this.name = options.name ?? "";
    this.loadedSystemVersion =
      options.loadedSystemVersion ?? this.systemVersion();
    this.milestones = [...(options.milestones ?? [])];
    this.sheets = [...(options.sheets ?? [])];
  }

  static fromJSON(json: any): Build {
    const t: string = json["system"];
    const handler = Build.FROM_JSON_REGISTRY[t];
    if (handler === undefined) {
      throw new Error(`Unknown system '${t}'!`);
    }
    return handler(json);
  }

  static FROM_JSON_REGISTRY: Record<string, (json: any) => Build> = {};

  toJSON(): object {
    return {
      id: this.id,
      name: this.name,
      system: this.systemName(),
      systemVersion: this.systemVersion(),
      milestones: this.milestones.map((m) => m.toJSON()),
      sheets: this.sheets.map((s) => s.toJSON()),
    };
  }

  abstract baseEntity(): Entity;

  entityAfterMilestone(milestone: Milestone): Entity {
    const e = this.baseEntity();
    for (const m of this.milestones) {
      m.apply(e);
      if (m === milestone) break;
    }
    return e;
  }
}
