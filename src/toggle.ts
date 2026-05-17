import { Entity, type EntityOptions } from "./entity";

const ETYPE = "toggle";

export class Toggle extends Entity {
  entityType(): string {
    return ETYPE;
  }

  constructor(options: EntityOptions = {}) {
    super(options);
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
    };
  }
}

Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Toggle(json);
};
