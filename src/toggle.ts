import type { Buildblazer } from "./buildblazer";
import { Entity, type EntityOptions } from "./entity";
import type { SystemEntity } from "./system";

/** A toggle is a flag that can be set or unset in sheets to control modifiers and the like. */
export class Toggle extends Entity {
  entityType(): string {
    return Toggle.ETYPE.id;
  }

  constructor(options: EntityOptions = {}) {
    super(options);
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
    };
  }

  /** Type information for this entity. Don't use this directly; {@link Buildblazer} already sets this up for you. */
  static ETYPE: SystemEntity = {
    id: "toggle",
    deserializer: Toggle.fromJSON,
  };

  /** Deserialize a toggle from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Toggle {
    return new Toggle({
      ...Entity.optionsFromJSON(bb, json),
    });
  }
}
