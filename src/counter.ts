import { Entity, type EntityOptions } from "./entity";
import type { SystemEntity } from "./system";

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
    return Counter.ETYPE.id;
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

  static ETYPE: SystemEntity = {
    id: "counter",
    deserializer: (json) => new Counter(json),
  };
}
