import type { Buildblazer } from "./buildblazer";
import { Entity, type EntityOptions } from "./entity";
import {
  ExprBin,
  ExprBinOp,
  Expression,
  parseExpression,
  type EvalContext,
} from "./expr";
import type { SystemEntity } from "./system";

/** An operation a modifier can do to the base value. Default is {@link ADD}. */
export enum ModifierOp {
  SET = "set",
  ADD = "add",
  SUB = "sub",
  MUL = "mul",
  DIV = "div",
}

/** Options for the constructor of {@link Modifier}. */
export interface ModifierOptions extends EntityOptions {
  /** The UUID of the statistic the be modified. */
  stat?: string;
  /** The operation this modifier does to the statistic. Default is {@link ModifierOp.ADD}. */
  op?: ModifierOp;
  /** The expression to modify the statistic by. */
  value?: string;
  /** The condition under which this modifier will apply. An expression that returns 0 if not applicable and anything else if it is applicable. */
  condition?: string;
}

/** A modifier is a numerical change to the value of a statistic. */
export class Modifier extends Entity {
  /** The UUID of the statistic the be modified, or the empty string if this has not yet been decided. */
  stat: string;
  /** The operation this modifier does to the statistic. */
  op: ModifierOp;
  /** The expression to modify the statistic by. Empty strings are treated as no-ops. */
  value: string;
  /**
   * The condition under which this modifier will apply.
   * An expression that returns 0 if not applicable and anything else if it is applicable.
   * If undefined, this is always applicable.
   */
  condition: string | undefined;

  entityType(): string {
    return Modifier.ETYPE.id;
  }

  constructor(options: ModifierOptions = {}) {
    super(options);
    this.stat = options.stat ?? "";
    this.op = options.op ?? ModifierOp.ADD;
    this.value = options.value ?? "0";
    this.condition = options.condition;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      stat: this.stat,
      op: this.op,
      value: this.value,
      condition: this.condition,
    };
  }

  /** Is this modifier applicable in this context? */
  isApplicable(ctx: EvalContext): boolean {
    if (!this.condition) {
      return true;
    }
    return parseExpression(this.condition).eval({
      ...ctx,
      currentEntity: this,
    })
      ? true
      : false;
  }

  /** Apply this modifier, regardless of condition, to the expression, returning a new expression. */
  apply(e: Expression, ctx: EvalContext): Expression {
    const value = parseExpression(this.value).simplify({
      ...ctx,
      currentEntity: this,
    });
    switch (this.op) {
      case ModifierOp.ADD:
        return new ExprBin(e, ExprBinOp.ADD, value);
      case ModifierOp.DIV:
        return new ExprBin(e, ExprBinOp.DIV, value);
      case ModifierOp.MUL:
        return new ExprBin(e, ExprBinOp.MUL, value);
      case ModifierOp.SET:
        return value;
      case ModifierOp.SUB:
        return new ExprBin(e, ExprBinOp.SUB, value);
      default:
        throw new Error(`Unknown modifier op '${this.op}'!`);
    }
  }

  /** Type information for this entity. Don't use this directly; {@link Buildblazer} already sets this up for you. */
  static ETYPE: SystemEntity = {
    id: "mod",
    deserializer: Modifier.fromJSON,
  };

  /** Deserialize a modifier from JSON. */
  static fromJSON(bb: Buildblazer, json: any): Modifier {
    return new Modifier({
      ...Entity.optionsFromJSON(bb, json),
      condition: json.condition,
      op: json.op,
      stat: json.stat,
      value: json.value,
    });
  }
}
