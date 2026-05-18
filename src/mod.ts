import { Entity, type EntityOptions } from "./entity";
import {
  ExprBin,
  ExprBinOp,
  Expression,
  parseExpression,
  type EvalContext,
} from "./expr";
import type { SystemEntity } from "./system";

export enum ModifierOp {
  SET = "set",
  ADD = "add",
  SUB = "sub",
  MUL = "mul",
  DIV = "div",
}

export interface ModifierOptions extends EntityOptions {
  stat?: string;
  op?: ModifierOp;
  value?: string;
  condition?: string;
}

export class Modifier extends Entity {
  stat: string;
  op: ModifierOp;
  value: string;
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

  toJSON(): object {
    return {
      ...super.toJSON(),
      stat: this.stat,
      op: this.op,
      value: this.value,
      condition: this.condition,
    };
  }

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

  static ETYPE: SystemEntity = {
    id: "mod",
    deserializer: (json) => new Modifier(json),
  };
}
