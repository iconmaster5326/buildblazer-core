import type { Buildblazer } from "./buildblazer";
import { Entity, type EntityOptions } from "./entity";
import type { SystemEntity } from "./system";

/** Options for the constructor of {@link Counter}. */
export interface CounterOptions extends EntityOptions {
  /** An expression string that represents the default value of this counter, either initially or when reset by things like rests. When the empty string, treat as 0. */
  defaultsTo?: string;
  /** An expression string that represents the minimum value of this counter. When the empty string, treat as unlimited. */
  min?: string;
  /** An expression string that represents the maximum value of this counter. When the empty string, treat as unlimited. */
  max?: string;
}

/**
 * A counter represents a number on a sheet whose value can vary during play.
 * Used for HP, wealth, uses of abilities per time period, and so on.
 */
export class Counter extends Entity {
  /** An expression string that represents the default value of this counter, either initially or when reset by things like rests. When the empty string, treat as 0. */
  defaultsTo: string;
  /** An expression string that represents the minimum value of this counter. When the empty string, treat as unlimited. */
  min: string;
  /** An expression string that represents the maximum value of this counter. When the empty string, treat as unlimited. */
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

  toJSON(): any {
    return {
      ...super.toJSON(),
      defaultsTo: this.defaultsTo,
      min: this.min,
      max: this.max,
    };
  }

  /** Type information for this entity. Don't use this directly; {@link Buildblazer} already sets this up for you. */
  static ETYPE: SystemEntity = {
    id: "counter",
    deserializer: Counter.fromJSON,
  };

  /** Deserialize a counter from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Counter {
    return new Counter({
      ...Entity.optionsFromJSON(bb, json),
      defaultsTo: json.defaultsTo,
      max: json.max,
      min: json.min,
    });
  }
}
