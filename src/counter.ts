import { Entity, type EntityOptions } from "./entity";

const ETYPE = "counter";

export interface CounterOptions extends EntityOptions {
  defaultsTo?: string;
  min?: string;
  max?: string;
}

export class Counter extends Entity {
  defaultsTo: string;
  min: string;
  max: string;

  entityType(): string {
    return ETYPE;
  }

  constructor(options: CounterOptions = {}) {
    super(options);
    this.defaultsTo = options.defaultsTo ?? "";
    this.min = options.min ?? "";
    this.max = options.max ?? "";
  }

  toJSON(): object {
    return {
      ...super.toJSON(),
      defaultsTo: this.defaultsTo,
      min: this.min,
      max: this.max,
    };
  }
}

Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Counter(json);
};
