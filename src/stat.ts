import * as entity from "./entity";

const ETYPE = "stat";

export class Statistic extends entity.Entity {
  entityType(): string {
    return ETYPE;
  }

  base: string;

  constructor(base: string, options: entity.EntityOptions = {}) {
    super(options);
    this.base = base;
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      base: this.base,
    }
  }
}

entity.Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Statistic(json["base"], json);
};
