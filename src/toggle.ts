import { Entity, type EntityOptions } from "./entity";
import type { SystemEntity } from "./system";

export class Toggle extends Entity {
  entityType(): string {
    return Toggle.ETYPE.id;
  }

  constructor(options: EntityOptions = {}) {
    super(options);
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
    };
  }

  static ETYPE: SystemEntity = {
    id: "toggle",
    deserializer: (json) => new Toggle(json),
  };
}
