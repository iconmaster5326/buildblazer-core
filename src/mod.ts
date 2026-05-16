import { Entity, type EntityOptions } from "./entity";
import { parseExpression, type EvalContext } from "./expr";

const ETYPE = "mod";

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
    return ETYPE;
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

  apply(n: number, ctx: EvalContext): number {
    const value = parseExpression(this.value).eval({
      ...ctx,
      currentEntity: this,
    });
    switch (this.op) {
      case ModifierOp.ADD:
        return n + value;
      case ModifierOp.DIV:
        return n / value;
      case ModifierOp.MUL:
        return n * value;
      case ModifierOp.SET:
        return value;
      case ModifierOp.SUB:
        return n - value;
      default:
        throw new Error(`Unknown modifier op '${this.op}'!`);
    }
  }
}

Entity.FROM_JSON_REGISTRY[ETYPE] = (json: any) => {
  return new Modifier(json);
};
